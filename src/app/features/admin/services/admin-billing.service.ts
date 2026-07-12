import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { AdminBillingRow } from '../../../core/models/billing.model';
import { SupabaseService } from '../../../core/services/supabase.service';
import { BillingService } from '../../../core/services/billing.service';

@Injectable({ providedIn: 'root' })
export class AdminBillingService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly billingService = inject(BillingService);

  private readonly rowsSignal = signal<AdminBillingRow[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly searchSignal = signal('');

  readonly rows = this.rowsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly search = this.searchSignal.asReadonly();

  unavailable(): boolean {
    return environment.useLocalApi;
  }

  setSearch(value: string): void {
    this.searchSignal.set(value);
  }

  async load(): Promise<void> {
    if (this.unavailable()) {
      this.rowsSignal.set([]);
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const client = this.supabaseService.getClient();
    if (!client) {
      this.loadingSignal.set(false);
      this.errorSignal.set('Billing admin requires the browser.');
      return;
    }

    const search = this.searchSignal().trim();
    const { data, error } = await client.rpc('admin_list_billing', {
      p_search: search.length > 0 ? search : null,
    });

    if (error) {
      this.loadingSignal.set(false);
      this.errorSignal.set(error.message);
      return;
    }

    this.rowsSignal.set(Array.isArray(data) ? (data as AdminBillingRow[]) : []);
    this.loadingSignal.set(false);
  }

  async extendTrial(userId: string, days: number): Promise<string | null> {
    const client = this.supabaseService.getClient();
    if (!client) {
      return 'Not available in SSR.';
    }

    const { error } = await client.rpc('admin_extend_trial', {
      p_user_id: userId,
      p_days: days,
    });

    if (error) {
      return error.message;
    }

    await this.load();
    return null;
  }

  async syncFromStripe(userId: string): Promise<string | null> {
    if (!this.billingService.isAvailable()) {
      return 'Stripe sync requires Supabase mode.';
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return 'Not available in SSR.';
    }

    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return 'You must be signed in.';
    }

    const { data, error } = await client.functions.invoke<{ error?: string }>(
      'admin-sync-subscription',
      {
        body: { userId },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (error) {
      return error.message;
    }

    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return data.error;
    }

    await this.load();
    return null;
  }
}
