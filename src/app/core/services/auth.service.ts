import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AppUser } from '../models/auth-user.model';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

export interface AuthResult {
  error: string | null;
  needsConfirmation?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);

  private readonly sessionSignal = signal<Session | null>(null);
  private readonly localUserSignal = signal<AppUser | null>(null);
  private readonly loadingSignal = signal(true);
  private initialized = false;

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
      return Promise.resolve();
    }

    this.initialized = true;

    if (!this.supabaseService.isBrowser()) {
      this.loadingSignal.set(false);
      return Promise.resolve();
    }

    if (environment.useLocalApi) {
      return this.initLocalAuth();
    }

    return this.initSupabaseAuth();
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
      return { error: error.message };
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

    const { data, error } = await client.auth.signUp({ email, password });

    if (error) {
      return { error: error.message };
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
