import { Injectable, effect, inject, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
  AdminAnalytics,
  AdminDateRange,
  AdminDateRangePreset,
  buildDateRange,
  mapAdminAnalyticsResponse,
} from '../models/admin-analytics.model';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Injectable({ providedIn: 'root' })
export class AdminAnalyticsService {
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);

  private readonly dataSignal = signal<AdminAnalytics | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly unavailableSignal = signal(false);
  private readonly lastUpdatedSignal = signal<string | null>(null);
  private readonly rangeSignal = signal<AdminDateRange>(buildDateRange('30d'));

  readonly data = this.dataSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly unavailable = this.unavailableSignal.asReadonly();
  readonly lastUpdated = this.lastUpdatedSignal.asReadonly();
  readonly dateRange = this.rangeSignal.asReadonly();

  constructor() {
    effect(() => {
      const userId = this.authService.user()?.id ?? null;
      if (!userId) {
        this.clear();
      }
    });
  }

  clear(): void {
    this.dataSignal.set(null);
    this.loadingSignal.set(false);
    this.errorSignal.set(null);
    this.unavailableSignal.set(false);
    this.lastUpdatedSignal.set(null);
  }

  setDateRangePreset(preset: AdminDateRangePreset): void {
    this.rangeSignal.set(buildDateRange(preset));
  }

  async load(): Promise<void> {
    if (environment.useLocalApi) {
      this.unavailableSignal.set(true);
      this.dataSignal.set(null);
      this.errorSignal.set(null);
      this.loadingSignal.set(false);
      return;
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      this.errorSignal.set('Analytics are only available in the browser.');
      return;
    }

    const range = this.rangeSignal();
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.unavailableSignal.set(false);

    try {
      const { data, error } = await client.rpc('get_admin_analytics', {
        p_start_date: range.startDate,
        p_end_date: range.endDate,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.dataSignal.set(mapAdminAnalyticsResponse(data));
      this.lastUpdatedSignal.set(new Date().toISOString());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load admin analytics.';
      this.errorSignal.set(message);
      this.dataSignal.set(null);
    } finally {
      this.loadingSignal.set(false);
    }
  }
}
