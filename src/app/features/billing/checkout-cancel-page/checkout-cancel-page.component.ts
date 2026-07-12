import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-checkout-cancel-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page mx-auto max-w-lg">
      <div class="card space-y-4 p-6 text-center">
        <h1 class="text-xl font-semibold text-stone-900">Checkout canceled</h1>
        <p class="text-sm text-stone-600">
          No subscription was created. Your current access is unchanged.
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <a routerLink="/pricing" class="btn-primary-sm">View plans</a>
          <a routerLink="/dashboard" class="btn-secondary-sm">Back to dashboard</a>
        </div>
      </div>
    </div>
  `,
})
export class CheckoutCancelPageComponent {}
