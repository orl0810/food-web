import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CheckoutPlanCode, billingErrorMessage } from '../models/billing.model';
import { SupabaseService } from './supabase.service';

interface CheckoutResponse {
  url: string;
  planCode?: CheckoutPlanCode;
}

interface PortalResponse {
  url: string;
}

interface BillingFunctionError {
  error?: string;
  code?: string;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly supabaseService = inject(SupabaseService);

  private readonly checkoutLoadingSignal = signal(false);
  private readonly portalLoadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly checkoutLoading = this.checkoutLoadingSignal.asReadonly();
  readonly portalLoading = this.portalLoadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  isAvailable(): boolean {
    return !environment.useLocalApi;
  }

  async startCheckout(planCode: CheckoutPlanCode): Promise<void> {
    const url = await this.createCheckoutSession(planCode);
    window.location.assign(url);
  }

  async createCheckoutSession(planCode: CheckoutPlanCode): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Billing is not available in local development mode.');
    }

    this.checkoutLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const response = await this.invokeFunction<CheckoutResponse>('create-checkout-session', {
        planCode,
      });
      if (!response.url) {
        throw new Error('Could not start checkout.');
      }
      return response.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start checkout.';
      this.errorSignal.set(message);
      throw error;
    } finally {
      this.checkoutLoadingSignal.set(false);
    }
  }

  async openCustomerPortal(): Promise<void> {
    const url = await this.createPortalSession();
    window.location.assign(url);
  }

  async createPortalSession(): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Billing is not available in local development mode.');
    }

    this.portalLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const response = await this.invokeFunction<PortalResponse>(
        'create-customer-portal-session',
        {}
      );
      if (!response.url) {
        throw new Error('Could not open billing portal.');
      }
      return response.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open billing portal.';
      this.errorSignal.set(message);
      throw error;
    } finally {
      this.portalLoadingSignal.set(false);
    }
  }

  private async invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const client = this.supabaseService.getClient();
    if (!client) {
      throw new Error('Billing is only available in the browser.');
    }

    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      throw new Error('You must be signed in.');
    }

    const { data, error } = await client.functions.invoke<T & BillingFunctionError>(name, {
      body,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) {
      throw new Error(error.message);
    }

    const payload = data as BillingFunctionError | T;
    if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
      throw new Error(billingErrorMessage(payload.code, payload.error));
    }

    return payload as T;
  }
}
