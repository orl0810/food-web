import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import {
  getExpirationLabel,
  getExpirationStatus,
} from '../../shared/utils/expiration.utils';
import { STORAGE_LOCATION_LABELS } from '../../core/models/food-item.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatCardComponent, EmptyStateComponent, LoadingStateComponent, RouterLink],
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-stone-900">Dashboard</h1>
        <p class="mt-1 text-sm text-stone-600">See what you have and what to use first.</p>
      </div>

      @if (inventoryService.loading()) {
        <app-loading-state message="Loading dashboard..." />
      } @else if (inventoryService.error()) {
        <p class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ inventoryService.error() }}
        </p>
      } @else if (inventoryService.totalCount() === 0) {
        <app-empty-state
          title="No food added yet"
          description="Start by adding what you already have in your fridge, freezer, or pantry."
          actionLabel="Go to inventory"
          (actionClick)="goToInventory()"
        />
      } @else {
        <div class="space-y-4 lg:grid lg:grid-cols-4 lg:gap-4 lg:space-y-0">
          <div class="grid grid-cols-3 gap-4 lg:col-span-3">
            <app-stat-card label="Total items" [value]="inventoryService.totalCount()" />
            <app-stat-card
              label="Expiring soon"
              [value]="inventoryService.expiringSoonCount()"
              subtitle="Next 3 days"
              variant="warning"
            />
            <app-stat-card
              label="Expired"
              [value]="inventoryService.expiredCount()"
              variant="danger"
            />
          </div>
          <div class="h-full rounded-xl border border-stone-200 bg-card p-5 shadow-sm">
            <p class="text-sm font-medium text-muted">By location</p>
            <div class="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p class="text-xl font-semibold text-stone-900">{{ inventoryService.locationCounts().fridge }}</p>
                <p class="text-xs text-stone-600">Fridge</p>
              </div>
              <div>
                <p class="text-xl font-semibold text-stone-900">{{ inventoryService.locationCounts().freezer }}</p>
                <p class="text-xs text-stone-600">Freezer</p>
              </div>
              <div>
                <p class="text-xl font-semibold text-stone-900">{{ inventoryService.locationCounts().pantry }}</p>
                <p class="text-xs text-stone-600">Pantry</p>
              </div>
            </div>
          </div>
        </div>

        <section class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-lg font-semibold text-stone-900">Use first</h2>
            <a routerLink="/inventory" class="text-sm font-medium text-brand-700 hover:text-brand-800">
              View inventory
            </a>
          </div>

          @if (inventoryService.useFirstItems().length === 0) {
            <p class="rounded-xl border border-stone-200 bg-card px-4 py-6 text-sm text-stone-600">
              No items with expiration dates yet. Add dates to see what to use first.
            </p>
          } @else {
            <div class="grid grid-cols-3 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (item of inventoryService.useFirstItems(); track item.id) {
                <article class="h-full rounded-xl border border-stone-200 bg-card p-4 shadow-sm">
                  <div class="flex h-full flex-col gap-2">
                    <div class="min-w-0">
                      <h3 class="truncate font-medium text-stone-900">{{ item.name }}</h3>
                      <p class="text-sm text-stone-600">
                        {{ locationLabels[item.location] }} · {{ item.quantity }}
                        {{ item.unit || 'units' }}
                      </p>
                    </div>
                    <span
                      class="self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
                      [class.bg-amber-100]="expirationStatus(item.expiration_date) === 'soon'"
                      [class.text-amber-800]="expirationStatus(item.expiration_date) === 'soon'"
                      [class.bg-stone-100]="expirationStatus(item.expiration_date) === 'ok'"
                      [class.text-stone-700]="expirationStatus(item.expiration_date) === 'ok'"
                    >
                      {{ expirationLabel(item.expiration_date) }}
                    </span>
                  </div>
                </article>
              }
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly inventoryService = inject(FoodInventoryService);
  private readonly router = inject(Router);
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  ngOnInit(): void {
    void this.inventoryService.loadItems();
  }

  expirationLabel(date: string | null): string {
    return getExpirationLabel(date);
  }

  expirationStatus(date: string | null) {
    return getExpirationStatus(date);
  }

  goToInventory(): void {
    void this.router.navigateByUrl('/inventory');
  }
}
