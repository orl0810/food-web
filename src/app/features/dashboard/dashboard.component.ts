import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { STORAGE_LOCATION_LABELS } from '../../core/models/food-item.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { MealPlanService } from '../../core/services/meal-plan.service';
import { SmartSuggestionService } from '../../core/services/smart-suggestion.service';
import { MealInspirationSliderComponent } from './components/meal-inspiration-slider/meal-inspiration-slider.component';
import { CompleteActionDialogComponent } from './components/complete-action-dialog/complete-action-dialog.component';
import { DashboardSmartActionCardComponent } from './components/dashboard-smart-action-card/dashboard-smart-action-card.component';
import {
  ActionCompletionPayload,
  DashboardAction,
} from './models/dashboard-action.model';
import { DashboardFacadeService } from './services/dashboard-facade.service';
import { UserProfileFacadeService } from '../user-profile/services/user-profile-facade.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FoodIconBadgeComponent } from '../../shared/components/food-icon-badge/food-icon-badge.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { TodaysMealPlanComponent } from '../../shared/components/todays-meal-plan/todays-meal-plan.component';
import { PreparedPortion } from '../../core/models/prepared-portion.model';
import { PreparedPortionService } from '../../core/services/prepared-portion.service';
import {
  ExpirationUrgency,
  getExpirationShortLabel,
  getExpirationUrgency,
  getUseFirstActionLabel,
} from '../../shared/utils/expiration.utils';
import { getPortionAvailabilityLabel } from '../../shared/utils/prepared-portion.utils';
import {
  buildUseFirstPortionPrompts,
  getBatchCookingInsight,
} from '../../shared/utils/prepared-portion-suggestions.utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    StatCardComponent,
    EmptyStateComponent,
    FoodIconBadgeComponent,
    LoadingStateComponent,
    TodaysMealPlanComponent,
    DashboardSmartActionCardComponent,
    MealInspirationSliderComponent,
    CompleteActionDialogComponent,
    RouterLink,
  ],
  template: `
    <div class="page">
      <app-dashboard-smart-action-card
        class="block"
        [action]="facade.currentSmartAction()"
        [busy]="facade.completing()"
        [successMessage]="facade.successMessage()"
        (primaryClick)="onSmartActionPrimary($event)"
        (dismissClick)="onSmartActionDismiss()"
      />

      <app-meal-inspiration-slider class="block" />

      @if (dialogAction(); as pendingAction) {
        <app-complete-action-dialog
          [action]="pendingAction"
          [draft]="dialogDraft()!"
          [busy]="facade.completing()"
          [error]="facade.error()"
          (confirmed)="onDialogConfirmed($event)"
          (cancelled)="closeDialog()"
        />
      }

      <app-todays-meal-plan />

      @if (profileFacade.stats()) {
        <section class="mt-8">
          <div class="mb-3 flex items-center justify-between gap-4">
            <h2 class="section-title">Your progress</h2>
            <a routerLink="/profile" [queryParams]="{ section: 'progress' }" class="btn-primary-sm shrink-0">
              View profile
            </a>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:gap-4">
            <app-stat-card
              label="Weekly completion"
              icon="clock"
              variant="success"
              [value]="(profileFacade.stats()?.weeklyCompletionPercentage ?? 0) + '%'"
            />
            <app-stat-card
              label="Planning streak"
              icon="basket"
              variant="warning"
              [value]="profileFacade.stats()?.completedWeeksStreak ?? 0"
              unit=" weeks"
            />
          </div>
        </section>
      }

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
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
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
                  <app-food-icon-badge [name]="item.name" [category]="item.category" />

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

        @if (preparedPortionService.useFirstPortions().length > 0) {
          <section class="card-featured overflow-hidden">
            <div class="flex items-center justify-between gap-4 border-b border-stone-200/70 px-4 py-4 sm:px-5">
              <h2 class="section-title">Ready to Use</h2>
              <a routerLink="/inventory" class="btn-primary-sm shrink-0">View all</a>
            </div>
            <div class="divide-y divide-stone-200/60">
              @for (portion of preparedPortionService.useFirstPortions(); track portion.id) {
                <a
                  routerLink="/inventory"
                  class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/40 sm:px-5"
                >
                  <app-food-icon-badge [name]="portion.name" category="Prepared / Leftovers" />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-stone-900">{{ portion.name }}</p>
                    <p class="mt-0.5 text-xs text-stone-500">{{ availabilityLabel(portion) }}</p>
                  </div>
                  @if (portion.expires_at) {
                    <span class="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {{ expirationShortLabel(portion.expires_at) }}
                    </span>
                  }
                </a>
              }
            </div>
          </section>
        }

        @if (preparedPortionService.expiringSoonPortions().length > 0) {
          <section class="card overflow-hidden">
            <div class="border-b border-stone-100 px-4 py-4 sm:px-5">
              <h2 class="section-title">Expiring Prepared Food</h2>
            </div>
            <div class="divide-y divide-stone-100">
              @for (portion of preparedPortionService.expiringSoonPortions(); track portion.id) {
                <div class="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div>
                    <p class="text-sm font-semibold text-stone-900">{{ portion.name }}</p>
                    <p class="mt-0.5 text-xs text-amber-700">
                      {{ portion.expires_at ? expirationShortLabel(portion.expires_at) : 'Expiring soon' }}
                    </p>
                  </div>
                  <a routerLink="/meal-plan" class="btn-secondary-sm shrink-0">Add to plan</a>
                </div>
              }
            </div>
          </section>
        }

        @if (batchInsight()) {
          <p class="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
            {{ batchInsight() }}
          </p>
        }

        @if (topOverall().length > 0 || topExpiring().length > 0) {
          <section class="card-featured overflow-hidden">
            <div class="flex items-center justify-between gap-4 border-b border-stone-200/70 px-4 py-4 sm:px-5">
              <h2 class="section-title">Smart Suggestions</h2>
              <a routerLink="/recipes" class="btn-primary-sm shrink-0">See all</a>
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
  readonly preparedPortionService = inject(PreparedPortionService);
  readonly suggestionService = inject(SmartSuggestionService);
  readonly facade = inject(DashboardFacadeService);
  readonly profileFacade = inject(UserProfileFacadeService);
  private readonly router = inject(Router);
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  readonly dialogAction = signal<DashboardAction | null>(null);
  readonly dialogDraft = signal<ActionCompletionPayload | null>(null);

  readonly topOverall = computed(() =>
    this.suggestionService.getSmartSuggestions().slice(0, 3)
  );
  readonly topExpiring = computed(() =>
    this.suggestionService.getSuggestionsForExpiringFoods().slice(0, 3)
  );

  readonly batchInsight = computed(() =>
    getBatchCookingInsight(
      this.mealPlanService.entries(),
      this.preparedPortionService.portions()
    )
  );

  readonly portionPrompts = computed(() =>
    buildUseFirstPortionPrompts(this.preparedPortionService.expiringSoonPortions())
  );

  ngOnInit(): void {
    void this.facade.loadDashboardData();
  }

  onSmartActionPrimary(action: DashboardAction): void {
    if (action.primaryKind === 'navigate' && action.primaryRoute) {
      void this.router.navigateByUrl(action.primaryRoute);
      return;
    }

    this.dialogDraft.set(this.facade.buildCompletionDraft(action));
    this.dialogAction.set(action);
  }

  onSmartActionDismiss(): void {
    const action = this.facade.currentSmartAction();
    if (action) {
      this.facade.dismiss(action);
    }
  }

  async onDialogConfirmed(payload: ActionCompletionPayload): Promise<void> {
    const action = this.dialogAction();
    if (!action) {
      return;
    }

    const { error } = await this.facade.completeAction(action, payload);
    if (!error) {
      this.closeDialog();
    }
  }

  closeDialog(): void {
    this.dialogAction.set(null);
    this.dialogDraft.set(null);
  }

  availabilityLabel(portion: PreparedPortion): string {
    return getPortionAvailabilityLabel(portion);
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
