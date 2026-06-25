import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import {
  AuthCallbackResult,
  AuthResult,
  MagicLinkResult,
} from '../models/auth.model';
import { AppUser } from '../models/auth-user.model';
import { formatAuthError } from '../utils/auth-error.utils';
import {
  getAuthCallbackUrl,
  getAuthResetPasswordUrl,
} from '../utils/auth-url.utils';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

export type { AuthResult, MagicLinkResult, AuthCallbackResult } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);

  private readonly sessionSignal = signal<Session | null>(null);
  private readonly localUserSignal = signal<AppUser | null>(null);
  private readonly loadingSignal = signal(true);
  private initialized = false;
  private readyPromise: Promise<void> | null = null;

  readonly session = this.sessionSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly user = computed<AppUser | null>(() => {
    if (environment.useLocalApi) {
      return this.localUserSignal();
    }
    const supabaseUser = this.sessionSignal()?.user;
    return supabaseUser ? { id: supabaseUser.id, email: supabaseUser.email } : null;
  });
  readonly isAuthenticated = computed(() => this.user() !== null);

  init(): Promise<void> {
    if (this.initialized) {
      return this.whenReady();
    }

    this.initialized = true;
    this.readyPromise = this.bootstrap();
    return this.readyPromise;
  }

  whenReady(): Promise<void> {
    if (!this.initialized) {
      return this.init();
    }
    return this.readyPromise ?? Promise.resolve();
  }

  getCurrentUser(): AppUser | null {
    return this.user();
  }

  async getSession(): Promise<Session | null> {
    if (environment.useLocalApi) {
      const user = this.localUserSignal();
      return user ? ({ user } as Session) : null;
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return null;
    }

    const { data } = await client.auth.getSession();
    return data.session;
  }

  async signInWithMagicLink(email: string): Promise<MagicLinkResult> {
    if (environment.useLocalApi) {
      return { error: 'Magic link sign-in is only available with Supabase.' };
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Authentication is only available in the browser.' };
    }

    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });

    if (error) {
      return { error: formatAuthError(error.message) };
    }

    return { error: null };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    if (environment.useLocalApi) {
      return this.signInLocal(email, password);
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Authentication is only available in the browser.' };
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: formatAuthError(error.message) };
    }

    this.sessionSignal.set(data.session);
    return { error: null };
  }

  async signUpWithPassword(email: string, password: string): Promise<AuthResult> {
    if (environment.useLocalApi) {
      return this.signUpLocal(email, password);
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Authentication is only available in the browser.' };
    }

    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });

    if (error) {
      return { error: formatAuthError(error.message) };
    }

    if (data.session) {
      this.sessionSignal.set(data.session);
      return { error: null };
    }

    return {
      error: null,
      needsConfirmation: true,
    };
  }

  async resetPasswordForEmail(email: string): Promise<MagicLinkResult> {
    if (environment.useLocalApi) {
      return { error: 'Password reset is only available with Supabase.' };
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Authentication is only available in the browser.' };
    }

    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAuthResetPasswordUrl(),
    });

    if (error) {
      return { error: formatAuthError(error.message) };
    }

    return { error: null };
  }

  async updatePassword(password: string): Promise<AuthResult> {
    if (environment.useLocalApi) {
      return { error: 'Password reset is only available with Supabase.' };
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Authentication is only available in the browser.' };
    }

    const { error } = await client.auth.updateUser({ password });

    if (error) {
      return { error: formatAuthError(error.message) };
    }

    return { error: null };
  }

  async handleAuthCallback(): Promise<AuthCallbackResult> {
    if (environment.useLocalApi) {
      return { error: 'Auth callback is only used with Supabase.', session: null };
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Authentication is only available in the browser.', session: null };
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const authError =
      hashParams.get('error_description') ??
      hashParams.get('error') ??
      queryParams.get('error_description') ??
      queryParams.get('error');

    if (authError) {
      return {
        error: formatAuthError(decodeURIComponent(authError.replace(/\+/g, ' '))),
        session: null,
      };
    }

    const { data, error } = await client.auth.getSession();

    if (error) {
      return { error: formatAuthError(error.message), session: null };
    }

    if (!data.session) {
      return {
        error: formatAuthError(
          'This sign-in link is invalid or has expired. Request a new one.'
        ),
        session: null,
      };
    }

    this.sessionSignal.set(data.session);
    return { error: null, session: data.session };
  }

  isRecoverySession(): boolean {
    if (environment.useLocalApi) {
      return false;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const type = hashParams.get('type') ?? new URLSearchParams(window.location.search).get('type');
    return type === 'recovery';
  }

  async signOut(): Promise<void> {
    if (environment.useLocalApi) {
      this.localApiService.clearStoredSession();
      this.localUserSignal.set(null);
      return;
    }

    const client = this.supabaseService.getClient();
    if (client) {
      await client.auth.signOut();
    }
    this.sessionSignal.set(null);
  }

  private bootstrap(): Promise<void> {
    if (!this.supabaseService.isBrowser()) {
      this.loadingSignal.set(false);
      return Promise.resolve();
    }

    if (environment.useLocalApi) {
      return this.initLocalAuth();
    }

    return this.initSupabaseAuth();
  }

  private async initLocalAuth(): Promise<void> {
    const storedSession = this.localApiService.getStoredSession();

    if (storedSession) {
      const user = await this.localApiService.getCurrentUser();
      this.localUserSignal.set(user);
      this.loadingSignal.set(false);
      return;
    }

    if (!environment.production && environment.skipLogin && environment.devUser) {
      try {
        const { email, password } = environment.devUser;
        const { user } = await this.localApiService.signIn(email, password);
        this.localUserSignal.set(user);
      } catch {
        // API unavailable — fall back to login page
      }
    }

    this.loadingSignal.set(false);
  }

  private initSupabaseAuth(): Promise<void> {
    const client = this.supabaseService.getClient();
    if (!client) {
      this.loadingSignal.set(false);
      return Promise.resolve();
    }

    client.auth.onAuthStateChange((_event, session) => {
      this.sessionSignal.set(session);
      this.loadingSignal.set(false);
    });

    return client.auth.getSession().then(({ data: { session } }) => {
      this.sessionSignal.set(session);
      this.loadingSignal.set(false);
    });
  }

  private async signInLocal(email: string, password: string): Promise<AuthResult> {
    if (!this.localApiService.isEnabled()) {
      return { error: 'Authentication is only available in the browser.' };
    }

    try {
      const { user } = await this.localApiService.signIn(email, password);
      this.localUserSignal.set(user);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Sign in failed.' };
    }
  }

  private async signUpLocal(email: string, password: string): Promise<AuthResult> {
    if (!this.localApiService.isEnabled()) {
      return { error: 'Authentication is only available in the browser.' };
    }

    try {
      const { user } = await this.localApiService.signUp(email, password);
      this.localUserSignal.set(user);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Sign up failed.' };
    }
  }
}
