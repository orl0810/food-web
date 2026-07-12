import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EntitlementService } from '../../../core/services/entitlement.service';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-checkout-success-page',
  standalone: true,
  imports: [RouterLink, LoadingStateComponent],
  template: `
    <div class="page mx-auto max-w-lg">
      <div class="card space-y-4 p-6 text-center">
        @if (processing()) {
          <app-loading-state message="Confirming your subscription..." />
          <p class="text-sm text-stone-600">
            This can take a few seconds while payment is verified. Attempt
            {{ attempt() }} of {{ maxAttempts }}.
          </p>
        } @else if (confirmed()) {
          <h1 class="text-xl font-semibold text-stone-900">You're all set!</h1>
          <p class="text-sm text-stone-600">Premium access is active. Redirecting to your dashboard...</p>
        } @else {
          <h1 class="text-xl font-semibold text-stone-900">Still processing</h1>
          <p class="text-sm text-stone-600">
            Your payment may still be syncing. This page never grants access on its own — we wait
            for server confirmation.
          </p>
          <div class="flex flex-wrap justify-center gap-3">
            <button type="button" class="btn-primary-sm" (click)="retry()">Check again</button>
            <a routerLink="/account/billing" class="btn-secondary-sm">Billing settings</a>
            <a routerLink="/dashboard" class="btn-secondary-sm">Dashboard</a>
          </div>
        }
      </div>
    </div>
  `,
})
export class CheckoutSuccessPageComponent implements OnInit {
  private readonly entitlements = inject(EntitlementService);
  private readonly router = inject(Router);

  readonly processing = signal(true);
  readonly confirmed = signal(false);
  readonly attempt = signal(0);
  readonly maxAttempts = 6;

  ngOnInit(): void {
    void this.waitForPremium();
  }

  retry(): void {
    void this.waitForPremium();
  }

  private async waitForPremium(): Promise<void> {
    this.processing.set(true);
    this.confirmed.set(false);

    const result = await this.entitlements.refreshWithRetry(
      (e) => e.isPremium && (e.isPaidSubscriber || e.subscriptionStatus === 'active'),
      this.maxAttempts,
      1500
    );

    this.processing.set(false);
    if (result?.isPremium && (result.isPaidSubscriber || result.subscriptionStatus === 'active')) {
      this.confirmed.set(true);
      setTimeout(() => void this.router.navigateByUrl('/dashboard'), 1500);
    }
  }
}
