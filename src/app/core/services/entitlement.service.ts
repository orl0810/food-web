import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import {
  EntitlementLoadStatus,
  FeatureKey,
  PREMIUM_FEATURES,
  UserEntitlements,
} from '../models/user-entitlements.model';
import { SupabaseService } from './supabase.service';
import {
  calculateTrialDaysRemainingUtc,
  createLocalDevEntitlements,
  normalizeEntitlements,
} from '../../shared/utils/entitlement.utils';
import { getMondayOfWeek } from '../../shared/utils/meal-plan.utils';

@Injectable({ providedIn: 'root' })
export class EntitlementService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly entitlementsSignal = signal<UserEntitlements | null>(null);
  private readonly statusSignal = signal<EntitlementLoadStatus>('idle');
  private readonly errorSignal = signal<string | null>(null);
  private focusListenerRegistered = false;
  private lastFocusRefresh = 0;

  readonly entitlements = this.entitlementsSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly isPremium = computed(() => this.entitlementsSignal()?.isPremium ?? false);
  readonly isTrial = computed(() => this.entitlementsSignal()?.isTrial ?? false);
  readonly trialDaysRemaining = computed(() => {
    const entitlements = this.entitlementsSignal();
    if (!entitlements?.trialEndsAt) {
      return null;
    }
    return calculateTrialDaysRemainingUtc(entitlements.trialEndsAt);
  });

  readonly isGracePeriod = computed(
    () => this.entitlementsSignal()?.subscriptionStatus === 'grace_period'
  );

  readonly billingUnavailableLocally = computed(() => environment.useLocalApi);

  async load(force = false): Promise<UserEntitlements | null> {
    if (this.statusSignal() === 'loading' && !force) {
      return this.entitlementsSignal();
    }

    this.statusSignal.set('loading');
    this.errorSignal.set(null);

    if (environment.useLocalApi) {
      const stub = createLocalDevEntitlements();
      this.entitlementsSignal.set(stub);
      this.statusSignal.set('loaded');
      return stub;
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      this.statusSignal.set('error');
      this.errorSignal.set('Entitlements are only available in the browser.');
      return null;
    }

    const { data, error } = await client.rpc('get_user_entitlements');
    if (error) {
      this.statusSignal.set('error');
      this.errorSignal.set(error.message);
      return null;
    }

    const normalized = normalizeEntitlements(data);
    if (!normalized) {
      this.statusSignal.set('error');
      this.errorSignal.set('Could not load entitlements.');
      return null;
    }

    this.entitlementsSignal.set(normalized);
    this.statusSignal.set('loaded');
    this.registerFocusRefresh();
    return normalized;
  }

  async refresh(): Promise<UserEntitlements | null> {
    return this.load(true);
  }

  async refreshWithRetry(
    predicate: (entitlements: UserEntitlements) => boolean,
    maxAttempts = 6,
    delayMs = 1500
  ): Promise<UserEntitlements | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const entitlements = await this.refresh();
      if (entitlements && predicate(entitlements)) {
        return entitlements;
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return this.entitlementsSignal();
  }

  canUseFeature(feature: FeatureKey): boolean {
    if (!PREMIUM_FEATURES.has(feature)) {
      return true;
    }
    return this.isPremium();
  }

  canCreatePersonalRecipe(): boolean {
    const entitlements = this.entitlementsSignal();
    if (!entitlements) {
      return true;
    }
    if (entitlements.isPremium) {
      return true;
    }
    const max = entitlements.limits.personalRecipes;
    if (max === null) {
      return true;
    }
    return entitlements.usage.personalRecipes < max;
  }

  canCreateOrActivateMealPlanWeek(weekStart: string): boolean {
    const entitlements = this.entitlementsSignal();
    if (!entitlements) {
      return true;
    }
    if (entitlements.isPremium) {
      return true;
    }
    const currentWeekStart = getMondayOfWeek(new Date());
    return weekStart === currentWeekStart;
  }

  canGenerateSmartSuggestion(): boolean {
    const entitlements = this.entitlementsSignal();
    if (!entitlements) {
      return true;
    }
    if (entitlements.isPremium) {
      return true;
    }
    const remaining = entitlements.usage.smartSuggestionsRemainingThisMonth;
    return remaining === null || remaining > 0;
  }

  private registerFocusRefresh(): void {
    if (!isPlatformBrowser(this.platformId) || this.focusListenerRegistered) {
      return;
    }
    this.focusListenerRegistered = true;
    window.addEventListener('focus', () => {
      const now = Date.now();
      if (now - this.lastFocusRefresh < 30_000) {
        return;
      }
      this.lastFocusRefresh = now;
      void this.refresh();
    });
  }
}
