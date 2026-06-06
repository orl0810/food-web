import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { STORAGE_LOCATION_LABELS } from '../../core/models/food-item.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { MealPlanService } from '../../core/services/meal-plan.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { TodaysMealPlanComponent } from '../../shared/components/todays-meal-plan/todays-meal-plan.component';
import {
  ExpirationUrgency,
  getExpirationShortLabel,
  getExpirationUrgency,
  getUseFirstActionLabel,
} from '../../shared/utils/expiration.utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    StatCardComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    TodaysMealPlanComponent,
    RouterLink,
  ],
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-stone-900">Dashboard</h1>
        <p class="mt-1 text-sm text-stone-600">See what you have and what to use first.</p>
      </div>

      <app-todays-meal-plan />

      <div class="mt-8 space-y-8">
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
        <div class="grid grid-cols-3 gap-3 sm:gap-4">
          <app-stat-card
            label="Total Items"
            icon="basket"
            variant="success"
            [value]="inventoryService.totalCount()"
          />
          <app-stat-card
            label="Expiring Soon"
            icon="clock"
            variant="warning"
            [value]="inventoryService.expiringSoonCount()"
          />
          <app-stat-card
            label="Expired"
            icon="warning"
            variant="danger"
            [value]="inventoryService.expiredCount()"
          />
          <app-stat-card
            label="Fridge"
            icon="fridge"
            [value]="inventoryService.locationCounts().fridge"
            unit=" items"
          />
          <app-stat-card
            label="Freezer"
            icon="freezer"
            [value]="inventoryService.locationCounts().freezer"
            unit=" items"
          />
          <app-stat-card
            label="Pantry"
            icon="pantry"
            [value]="inventoryService.locationCounts().pantry"
            unit=" items"
          />
        </div>

        <section class="overflow-hidden rounded-xl border border-stone-200 bg-amber-50/40 shadow-sm">
          <div class="flex items-center justify-between gap-4 border-b border-stone-200/70 px-4 py-4 sm:px-5">
            <h2 class="text-base font-semibold text-stone-900">Use These First</h2>
            <a
              routerLink="/recipes"
              class="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              Cook with these
            </a>
          </div>

          @if (inventoryService.useFirstItems().length === 0) {
            <p class="px-4 py-6 text-sm text-stone-600 sm:px-5">
              No items with expiration dates yet. Add dates to see what to use first.
            </p>
          } @else {
            <div class="divide-y divide-stone-200/70 overflow-x-auto">
              @for (item of inventoryService.useFirstItems(); track item.id) {
                <article class="flex w-max min-w-full items-center gap-3 px-4 py-2 sm:gap-5 sm:px-5">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-stone-200/80"
                    aria-hidden="true"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 text-stone-400">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H5.25A2.25 2.25 0 0 0 3 5.25v13.5A2.25 2.25 0 0 0 5.25 21Z" />
                    </svg>
                  </div>

                  <p class="shrink-0 text-sm font-semibold text-stone-900">{{ item.name }}</p>

                  <p class="shrink-0 text-sm whitespace-nowrap">
                    <span class="text-stone-500">Expir: </span>
                    <span
                      class="font-medium"
                      [class.text-red-600]="expirationUrgency(item.expiration_date) === 'today' || expirationUrgency(item.expiration_date) === 'soon'"
                      [class.text-amber-600]="expirationUrgency(item.expiration_date) === 'tomorrow'"
                      [class.text-stone-700]="expirationUrgency(item.expiration_date) === 'later'"
                    >
                      {{ expirationShortLabel(item.expiration_date) }}
                    </span>
                  </p>

                  <p class="shrink-0 text-sm whitespace-nowrap">
                    <span class="text-stone-500">Location: </span>
                    <span class="font-medium text-stone-800">{{ locationLabels[item.location] }}</span>
                  </p>

                  <p class="shrink-0 text-sm whitespace-nowrap">
                    <span class="text-stone-500">Quantity: </span>
                    <span class="font-medium text-stone-800">{{ item.quantity }} {{ item.unit || 'units' }}</span>
                  </p>

                  <span
                    class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                    [class.bg-red-50]="expirationUrgency(item.expiration_date) === 'today'"
                    [class.text-red-700]="expirationUrgency(item.expiration_date) === 'today'"
                    [class.bg-amber-50]="expirationUrgency(item.expiration_date) === 'tomorrow' || expirationUrgency(item.expiration_date) === 'soon'"
                    [class.text-amber-700]="expirationUrgency(item.expiration_date) === 'tomorrow' || expirationUrgency(item.expiration_date) === 'soon'"
                    [class.bg-stone-100]="expirationUrgency(item.expiration_date) === 'later'"
                    [class.text-stone-700]="expirationUrgency(item.expiration_date) === 'later'"
                  >
                    {{ useFirstActionLabel(item.expiration_date) }}
                  </span>
                </article>
              }
            </div>
          }
        </section>
      }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly inventoryService = inject(FoodInventoryService);
  readonly mealPlanService = inject(MealPlanService);
  private readonly router = inject(Router);
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  ngOnInit(): void {
    void this.inventoryService.loadItems();
    void this.mealPlanService.getTodayMeals();
  }

  expirationShortLabel(date: string | null): string {
    return getExpirationShortLabel(date);
  }

  expirationUrgency(date: string | null): ExpirationUrgency {
    return getExpirationUrgency(date);
  }

  useFirstActionLabel(date: string | null): string {
    return getUseFirstActionLabel(date);
  }

  goToInventory(): void {
    void this.router.navigateByUrl('/inventory');
  }
}
