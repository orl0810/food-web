import { Injectable, computed, inject, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);

  private readonly sessionSignal = signal<Session | null>(null);
  private readonly loadingSignal = signal(true);
  private initialized = false;

  readonly session = this.sessionSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly user = computed<User | null>(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  init(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }

    this.initialized = true;

    if (!this.supabaseService.isBrowser()) {
      this.loadingSignal.set(false);
      return Promise.resolve();
    }

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

  async signInWithMagicLink(email: string): Promise<{ error: string | null }> {
    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Authentication is only available in the browser.' };
    }

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    return { error: error?.message ?? null };
  }

  async handleAuthCallback(): Promise<{ error: string | null }> {
    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Authentication is only available in the browser.' };
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      return { error: error.message };
    }

    if (!data.session) {
      return { error: 'No active session found. Please request a new magic link.' };
    }

    this.sessionSignal.set(data.session);
    return { error: null };
  }

  async signOut(): Promise<void> {
    const client = this.supabaseService.getClient();
    if (client) {
      await client.auth.signOut();
    }
    this.sessionSignal.set(null);
  }
}
