import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly platformId = inject(PLATFORM_ID);
  private client: SupabaseClient | null = null;

  getClient(): SupabaseClient | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    if (!this.client) {
      this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      });
    }

    return this.client;
  }

  isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
