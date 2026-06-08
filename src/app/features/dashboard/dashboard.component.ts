import { Component, computed, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { STORAGE_LOCATION_LABELS } from '../../core/models/food-item.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { MealPlanService } from '../../core/services/meal-plan.service';
import { SmartSuggestionService } from '../../core/services/smart-suggestion.service';
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
    <div class="page">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">See what you have and what to use first.</p>
      </div>

      <app-todays-meal-plan />

      <div class="mt-8 space-y-8">
      @if (inventoryService.loading()) {
        <app-loading-state message="Loading dashboard..." />
      } @else if (inventoryService.error()) {
        <p class="alert-error">
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

        <section class="card-featured overflow-hidden">
          <div class="flex items-center justify-between gap-4 border-b border-stone-200/70 px-4 py-4 sm:px-5">
            <h2 class="section-title">Use These First</h2>
            <a routerLink="/recipes" class="btn-primary-sm shrink-0">
              Cook with these
            </a>
          </div>

          @if (inventoryService.useFirstItems().length === 0) {
            <p class="px-4 py-6 text-sm text-stone-600 sm:px-5">
              No items with expiration dates yet. Add dates to see what to use first.
            </p>
          } @else {
            <div class="divide-y divide-stone-200/60">
              @for (item of inventoryService.useFirstItems(); track item.id) {
                <article class="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-white/40 sm:items-center sm:gap-3 sm:px-5">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200/80"
                    aria-hidden="true"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 text-stone-400">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H5.25A2.25 2.25 0 0 0 3 5.25v13.5A2.25 2.25 0 0 0 5.25 21Z" />
                    </svg>
                  </div>

                  <div class="min-w-0 flex-1 sm:flex sm:items-center sm:gap-5">
                    <p class="truncate text-sm font-semibold text-stone-900 sm:w-32 sm:shrink-0 lg:w-40">
                      {{ item.name }}
                    </p>

                    <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 sm:mt-0 sm:flex-1">
                      <span
                        class="font-medium"
                        [class.text-red-600]="expirationUrgency(item.expiration_date) === 'today' || expirationUrgency(item.expiration_date) === 'soon'"
                        [class.text-amber-600]="expirationUrgency(item.expiration_date) === 'tomorrow'"
                        [class.text-stone-600]="expirationUrgency(item.expiration_date) === 'later'"
                      >
                        {{ expirationShortLabel(item.expiration_date) }}
                      </span>
                      <span class="text-stone-300" aria-hidden="true">·</span>
                      <span>{{ locationLabels[item.location] }}</span>
                      <span class="text-stone-300" aria-hidden="true">·</span>
                      <span>{{ item.quantity }} {{ item.unit || 'units' }}</span>
                    </p>
                  </div>

                  <span
                    class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight sm:self-center"
                    [class.bg-red-50]="expirationUrgency(item.expiration_date) === 'today'"
                    [class.text-red-700]="expirationUrgency(item.expiration_date) === 'today'"
                    [class.bg-amber-50]="expirationUrgency(item.expiration_date) === 'tomorrow' || expirationUrgency(item.expiration_date) === 'soon'"
                    [class.text-amber-700]="expirationUrgency(item.expiration_date) === 'tomorrow' || expirationUrgency(item.expiration_date) === 'soon'"
                    [class.bg-stone-100]="expirationUrgency(item.expiration_date) === 'later'"
                    [class.text-stone-600]="expirationUrgency(item.expiration_date) === 'later'"
                  >
                    {{ useFirstActionLabel(item.expiration_date) }}
                  </span>
                </article>
              }
            </div>
          }
        </section>

        @if (topOverall().length > 0 || topExpiring().length > 0) {
          <section class="card-featured overflow-hidden">
            <div class="flex items-center justify-between gap-4 border-b border-stone-200/70 px-4 py-4 sm:px-5">
              <h2 class="section-title">Smart Suggestions</h2>
              <a routerLink="/suggestions" class="btn-primary-sm shrink-0">See all</a>
            </div>
            <div class="grid gap-0 divide-stone-200/60 sm:grid-cols-2 sm:divide-x">
              <div class="divide-y divide-stone-200/60">
                <p class="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-stone-500 sm:px-5">
                  Top picks
                </p>
                @for (suggestion of topOverall(); track suggestion.recipe.id) {
                  <a
                    [routerLink]="['/recipes', suggestion.recipe.id]"
                    class="block px-4 py-3 transition-colors hover:bg-white/40 sm:px-5"
                  >
                    <p class="text-sm font-semibold text-stone-900">{{ suggestion.recipe.title }}</p>
                    @if (suggestion.reasons.length > 0) {
                      <p class="mt-0.5 text-xs text-stone-500">{{ suggestion.reasons[0] }}</p>
                    }
                  </a>
                } @empty {
                  <p class="px-4 py-3 text-sm text-stone-500 sm:px-5">No suggestions yet.</p>
                }
              </div>
              <div class="divide-y divide-stone-200/60">
                <p class="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-stone-500 sm:px-5">
                  Use expiring foods
                </p>
                @for (suggestion of topExpiring(); track suggestion.recipe.id) {
                  <a
                    [routerLink]="['/recipes', suggestion.recipe.id]"
                    class="block px-4 py-3 transition-colors hover:bg-white/40 sm:px-5"
                  >
                    <p class="text-sm font-semibold text-stone-900">{{ suggestion.recipe.title }}</p>
                    @if (suggestion.reasons.length > 0) {
                      <p class="mt-0.5 text-xs text-stone-500">{{ suggestion.reasons[0] }}</p>
                    }
                  </a>
                } @empty {
                  <p class="px-4 py-3 text-sm text-stone-500 sm:px-5">Nothing expiring soon.</p>
                }
              </div>
            </div>
          </section>
        }
      }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly inventoryService = inject(FoodInventoryService);
  readonly mealPlanService = inject(MealPlanService);
  readonly suggestionService = inject(SmartSuggestionService);
  private readonly router = inject(Router);
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  readonly topOverall = computed(() =>
    this.suggestionService.getSmartSuggestions().slice(0, 3)
  );
  readonly topExpiring = computed(() =>
    this.suggestionService.getSuggestionsForExpiringFoods().slice(0, 3)
  );

  ngOnInit(): void {
    void this.mealPlanService.getTodayMeals();
    void this.suggestionService.refresh();
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
