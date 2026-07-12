import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingService } from '../../../core/services/billing.service';
import { EntitlementService } from '../../../core/services/entitlement.service';
import { EARLY_ACCESS_PLANS } from '../../../core/models/billing.model';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [DatePipe, RouterLink, LoadingStateComponent, EmptyStateComponent],
  template: `
    <div class="page">
      <div>
        <h1 class="page-title">Early Access Pricing</h1>
        <p class="page-subtitle">
          Full access to PantryFlow while we build together. Founding prices are kept while your
          subscription stays active.
        </p>
      </div>

      @if (!billing.isAvailable()) {
        <app-empty-state
          title="Billing requires Supabase mode"
          description="Pricing and checkout are available in production Supabase mode."
        />
      } @else if (entitlements.status() === 'loading' && !entitlements.entitlements()) {
        <app-loading-state message="Loading your plan..." />
      } @else {
        @if (entitlements.entitlements(); as e) {
          <section class="card space-y-2 p-5">
            <h2 class="section-title">Your access</h2>
            @if (e.isTrial && e.trialDaysRemaining !== null) {
              <p class="text-sm text-stone-700">
                Trial: <strong>{{ e.trialDaysRemaining }} day(s)</strong> remaining
                @if (e.trialEndsAt) {
                  (ends {{ e.trialEndsAt | date: 'mediumDate' }})
                }
              </p>
            } @else if (e.isPaidSubscriber) {
              <p class="text-sm text-stone-700">
                Current plan:
                <strong>{{ formatPlanCode(e.planCode) }}</strong>
                @if (e.currentPeriodEndsAt) {
                  · renews {{ e.currentPeriodEndsAt | date: 'mediumDate' }}
                }
              </p>
            } @else if (!e.isPremium) {
              <p class="text-sm text-stone-700">
                Your trial has ended. Choose a plan to restore premium features.
              </p>
            }
            @if (e.subscriptionStatus === 'grace_period' && e.gracePeriodEndsAt) {
              <p class="alert-warning text-sm">
                Payment issue — fix by {{ e.gracePeriodEndsAt | date: 'medium' }} to keep access.
              </p>
            }
            @if (e.canManageBilling) {
              <button
                type="button"
                class="btn-secondary-sm mt-2"
                [disabled]="billing.portalLoading()"
                (click)="openPortal()"
              >
                Manage billing
              </button>
            }
          </section>
        }

        @if (billing.error()) {
          <p class="alert-error">{{ billing.error() }}</p>
        }

        <div class="grid gap-4 md:grid-cols-2">
          @for (plan of plans; track plan.code) {
            <article
              class="card flex flex-col p-5"
              [class.card-featured]="plan.recommended"
            >
              @if (plan.recommended) {
                <span class="mb-2 inline-flex w-fit rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                  Best value
                </span>
              }
              <h3 class="text-lg font-semibold text-stone-900">{{ plan.name }}</h3>
              <p class="mt-1 text-3xl font-bold text-brand-700">
                {{ plan.priceLabel }}
                <span class="text-base font-normal text-stone-600">/ {{ plan.intervalLabel }}</span>
              </p>
              @if (plan.monthlyEquivalent) {
                <p class="text-sm text-stone-600">{{ plan.monthlyEquivalent }}</p>
              }
              @if (plan.savingsLabel) {
                <p class="text-sm font-medium text-emerald-700">{{ plan.savingsLabel }}</p>
              }
              <ul class="mt-4 flex-1 space-y-2 text-sm text-stone-700">
                @for (feature of plan.features; track feature) {
                  <li class="flex gap-2">
                    <span aria-hidden="true">✓</span>
                    <span>{{ feature }}</span>
                  </li>
                }
              </ul>
              <button
                type="button"
                class="btn-primary mt-5 w-full"
                [disabled]="billing.checkoutLoading() || !canSubscribe()"
                (click)="startCheckout(plan.code)"
              >
                @if (billing.checkoutLoading()) {
                  Starting checkout...
                } @else {
                  Choose {{ plan.name }}
                }
              </button>
            </article>
          }
        </div>

        <p class="text-xs text-stone-500">
          Recurring billing. Cancel anytime from the Stripe Customer Portal — cancellation takes
          effect at the end of your current billing period. No card is required during the free
          trial.
        </p>
      }
    </div>
  `,
})
export class PricingPageComponent implements OnInit {
  readonly billing = inject(BillingService);
  readonly entitlements = inject(EntitlementService);
  readonly plans = EARLY_ACCESS_PLANS;

  ngOnInit(): void {
    void this.entitlements.load();
  }

  canSubscribe(): boolean {
    const e = this.entitlements.entitlements();
    if (!e) {
      return true;
    }
    if (e.isPaidSubscriber && e.isPremium) {
      return false;
    }
    return true;
  }

  startCheckout(planCode: (typeof EARLY_ACCESS_PLANS)[number]['code']): void {
    void this.billing.startCheckout(planCode);
  }

  openPortal(): void {
    void this.billing.openCustomerPortal();
  }

  formatPlanCode(code: string): string {
    return code.replace(/_/g, ' ');
  }
}
