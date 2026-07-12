import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EntitlementService } from '../../../core/services/entitlement.service';
import { BillingService } from '../../../core/services/billing.service';
import { getTrialBannerTier } from '../../utils/entitlement.utils';

@Component({
  selector: 'app-trial-status-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (tier() !== 'none') {
      <div [class]="bannerClass()" role="status">
        @switch (tier()) {
          @case ('grace') {
            <p class="text-sm">
              <strong>Payment issue.</strong> Update your payment method before your grace period
              ends to keep premium access.
            </p>
            <button type="button" class="btn-primary-sm shrink-0" (click)="openPortal()">
              Fix payment
            </button>
          }
          @case ('discreet') {
            <p class="text-sm">
              Early Access trial —
              <strong>{{ entitlements.trialDaysRemaining() }} days</strong> remaining.
            </p>
          }
          @case ('intro_pricing') {
            <p class="text-sm">
              <strong>{{ entitlements.trialDaysRemaining() }} days</strong> left in your trial.
              <a routerLink="/pricing" class="ml-1 font-medium underline">See Early Access pricing</a>
            </p>
          }
          @case ('warning') {
            <p class="text-sm font-medium">
              Trial ending soon — {{ entitlements.trialDaysRemaining() }} day(s) left.
              <a routerLink="/pricing" class="ml-1 underline">Subscribe from €3/month</a>
            </p>
          }
          @case ('urgent') {
            <p class="text-sm font-semibold">
              Last day of your trial! <a routerLink="/pricing" class="underline">Upgrade now</a>
              to keep full access.
            </p>
          }
          @case ('expired') {
            <p class="text-sm font-medium">
              Your trial has ended.
              <a routerLink="/pricing" class="ml-1 underline">Choose Early Access</a>
              to unlock premium features.
            </p>
          }
        }
      </div>
    }
  `,
})
export class TrialStatusBannerComponent {
  readonly entitlements = inject(EntitlementService);
  readonly billing = inject(BillingService);

  readonly tier = computed(() => getTrialBannerTier(this.entitlements.entitlements()));

  bannerClass(): string {
    const tier = this.tier();
    const base = 'mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2';
    switch (tier) {
      case 'grace':
        return `${base} border-b border-amber-200 bg-amber-50 text-amber-900`;
      case 'urgent':
      case 'expired':
        return `${base} border-b border-red-200 bg-red-50 text-red-900`;
      case 'warning':
        return `${base} border-b border-orange-200 bg-orange-50 text-orange-900`;
      case 'intro_pricing':
        return `${base} border-b border-brand-200 bg-brand-50 text-brand-900`;
      default:
        return `${base} border-b border-stone-200 bg-stone-50 text-stone-700`;
    }
  }

  openPortal(): void {
    void this.billing.openCustomerPortal();
  }
}
