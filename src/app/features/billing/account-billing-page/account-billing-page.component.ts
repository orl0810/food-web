import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingService } from '../../../core/services/billing.service';
import { EntitlementService } from '../../../core/services/entitlement.service';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-account-billing-page',
  standalone: true,
  imports: [DatePipe, RouterLink, LoadingStateComponent, EmptyStateComponent],
  template: `
    <div class="page">
      <div>
        <h1 class="page-title">Billing</h1>
        <p class="page-subtitle">Manage your Early Access subscription and trial.</p>
      </div>

      @if (!billing.isAvailable()) {
        <app-empty-state
          title="Billing requires Supabase mode"
          description="Account billing is available in production Supabase mode."
        />
      } @else if (entitlements.status() === 'loading' && !entitlements.entitlements()) {
        <app-loading-state message="Loading billing details..." />
      } @else if (entitlements.error()) {
        <p class="alert-error">{{ entitlements.error() }}</p>
        <button type="button" class="btn-secondary" (click)="refresh()">Retry</button>
      } @else if (entitlements.entitlements(); as e) {
        <section class="card space-y-4 p-5">
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-stone-500">Plan</p>
              <p class="font-semibold text-stone-900">{{ formatPlanCode(e.planCode) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-stone-500">Status</p>
              <p class="font-semibold text-stone-900">{{ formatStatus(e.subscriptionStatus) }}</p>
            </div>
            @if (e.isTrial && e.trialEndsAt) {
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-stone-500">Trial ends</p>
                <p class="font-semibold text-stone-900">{{ e.trialEndsAt | date: 'mediumDate' }}</p>
              </div>
            }
            @if (e.currentPeriodEndsAt) {
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-stone-500">
                  {{ e.cancelAtPeriodEnd ? 'Access ends' : 'Next renewal' }}
                </p>
                <p class="font-semibold text-stone-900">
                  {{ e.currentPeriodEndsAt | date: 'mediumDate' }}
                </p>
              </div>
            }
            @if (e.isPaidSubscriber && e.currentPeriodStartedAt) {
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-stone-500">
                  Billing interval
                </p>
                <p class="font-semibold text-stone-900">
                  {{ e.planCode === 'early_access_annual' ? 'Annual' : 'Monthly' }}
                </p>
              </div>
            }
          </div>

          @if (e.cancelAtPeriodEnd) {
            <p class="alert-warning text-sm">
              Your subscription is set to cancel at the end of the current billing period.
            </p>
          }

          @if (e.subscriptionStatus === 'grace_period' && e.gracePeriodEndsAt) {
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p class="font-medium text-amber-900">Payment recovery required</p>
              <p class="mt-1 text-sm text-amber-800">
                Your last payment failed. Update your payment method by
                {{ e.gracePeriodEndsAt | date: 'medium' }} to keep premium access.
              </p>
              <button
                type="button"
                class="btn-primary-sm mt-3"
                [disabled]="billing.portalLoading()"
                (click)="openPortal()"
              >
                Fix payment
              </button>
            </div>
          }

          <div class="flex flex-wrap gap-3">
            @if (e.canManageBilling) {
              <button
                type="button"
                class="btn-primary-sm"
                [disabled]="billing.portalLoading()"
                (click)="openPortal()"
              >
                Manage billing
              </button>
            }
            @if (!e.isPaidSubscriber || !e.isPremium) {
              <a routerLink="/pricing" class="btn-secondary-sm">Choose a plan</a>
            }
            <button type="button" class="btn-secondary-sm" (click)="refresh()">Refresh status</button>
          </div>
        </section>

        @if (!e.isPremium) {
          <section class="card p-5 text-sm text-stone-700">
            <h2 class="section-title">Free plan limits</h2>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li>1 active meal-plan week (current week)</li>
              <li>10 personal recipes (you have {{ e.usage.personalRecipes }})</li>
              <li>3 AI recipe generations per month ({{ e.usage.smartSuggestionsUsedThisMonth }} used)</li>
              <li>Manual planning and basic inventory remain available</li>
            </ul>
          </section>
        }
      }
    </div>
  `,
})
export class AccountBillingPageComponent implements OnInit {
  readonly billing = inject(BillingService);
  readonly entitlements = inject(EntitlementService);

  ngOnInit(): void {
    void this.entitlements.load();
  }

  refresh(): void {
    void this.entitlements.refresh();
  }

  openPortal(): void {
    void this.billing.openCustomerPortal();
  }

  formatPlanCode(code: string): string {
    return code.replace(/_/g, ' ');
  }

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ');
  }
}
