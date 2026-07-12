import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AdminBillingService } from '../../services/admin-billing.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-admin-billing-section',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent, LoadingStateComponent],
  template: `
    <section class="space-y-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="section-title">Billing</h2>
          <p class="text-sm text-stone-600">Sanitized subscription state for support and ops.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <input
            type="search"
            class="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            placeholder="Search email or name"
            [value]="billing.search()"
            (input)="onSearch($event)"
          />
          <button type="button" class="btn-secondary-sm" (click)="billing.load()">Refresh</button>
        </div>
      </div>

      @if (billing.unavailable()) {
        <app-empty-state
          title="Billing admin requires Supabase"
          description="Subscription management is available in production Supabase mode."
        />
      } @else if (billing.loading() && billing.rows().length === 0) {
        <app-loading-state message="Loading billing records..." />
      } @else if (billing.error()) {
        <p class="alert-error">{{ billing.error() }}</p>
      } @else if (billing.rows().length === 0) {
        <app-empty-state title="No billing records" description="No users match your search." />
      } @else {
        <div class="overflow-x-auto rounded-xl border border-stone-200">
          <table class="min-w-full divide-y divide-stone-200 text-sm">
            <thead class="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th class="px-3 py-2">User</th>
                <th class="px-3 py-2">Plan</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Trial end</th>
                <th class="px-3 py-2">Period end</th>
                <th class="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100 bg-white">
              @for (row of billing.rows(); track row.user_id) {
                <tr>
                  <td class="px-3 py-3">
                    <p class="font-medium text-stone-900">{{ row.display_name || '—' }}</p>
                    <p class="text-xs text-stone-500">{{ row.email }}</p>
                  </td>
                  <td class="px-3 py-3">{{ row.plan_code || '—' }}</td>
                  <td class="px-3 py-3">
                    {{ row.subscription_status || '—' }}
                    @if (row.is_premium) {
                      <span class="ml-1 text-xs text-emerald-700">premium</span>
                    }
                  </td>
                  <td class="px-3 py-3">
                    {{ row.trial_ends_at ? (row.trial_ends_at | date: 'mediumDate') : '—' }}
                  </td>
                  <td class="px-3 py-3">
                    {{ row.current_period_ends_at ? (row.current_period_ends_at | date: 'mediumDate') : '—' }}
                  </td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="btn-secondary-sm"
                        [disabled]="actionUserId() === row.user_id"
                        (click)="extendTrial(row.user_id, 7)"
                      >
                        +7d trial
                      </button>
                      <button
                        type="button"
                        class="btn-secondary-sm"
                        [disabled]="actionUserId() === row.user_id"
                        (click)="syncStripe(row.user_id)"
                      >
                        Sync Stripe
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (actionMessage()) {
        <p class="text-sm text-stone-600">{{ actionMessage() }}</p>
      }
    </section>
  `,
})
export class AdminBillingSectionComponent implements OnInit {
  readonly billing = inject(AdminBillingService);
  readonly actionUserId = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);

  ngOnInit(): void {
    void this.billing.load();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.billing.setSearch(value);
    void this.billing.load();
  }

  async extendTrial(userId: string, days: number): Promise<void> {
    this.actionUserId.set(userId);
    this.actionMessage.set(null);
    const error = await this.billing.extendTrial(userId, days);
    this.actionUserId.set(null);
    this.actionMessage.set(error ?? `Extended trial by ${days} days.`);
  }

  async syncStripe(userId: string): Promise<void> {
    this.actionUserId.set(userId);
    this.actionMessage.set(null);
    const error = await this.billing.syncFromStripe(userId);
    this.actionUserId.set(null);
    this.actionMessage.set(error ?? 'Stripe sync requested.');
  }
}
