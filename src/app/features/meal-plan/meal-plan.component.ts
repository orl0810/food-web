import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_TIME_RANGES,
  MealPlanEntry,
  MealType,
} from '../../core/models/meal-plan.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { MealPlanService } from '../../core/services/meal-plan.service';
import { RecipeService } from '../../core/services/recipe.service';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import {
  formatDayShort,
  formatFullDayHeading,
  formatWeekRangeCompact,
  isToday,
  toISODate,
} from '../../shared/utils/meal-plan.utils';
import {
  getIngredientAvailability,
  IngredientAvailability,
} from '../../shared/utils/recipe-availability.utils';
import { MealPlanRecipePickerComponent } from './meal-plan-recipe-picker.component';

interface SelectedSlot {
  date: string;
  mealType: MealType;
}

interface WeekStats {
  mealsPlanned: number;
  ingredientsReadyPercent: number | null;
  itemsNeeded: number;
}

@Component({
  selector: 'app-meal-plan',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, LoadingStateComponent, StatCardComponent, MealPlanRecipePickerComponent],
  template: `
    <div class="page">
      <div>
        <h1 class="page-title">Meal Plan</h1>
        <p class="page-subtitle">Plan your week and reduce waste.</p>
      </div>

      <!-- Week navigation -->
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50"
          aria-label="Previous week"
          (click)="onPreviousWeek()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div class="min-w-0 text-center">
          <p class="text-base font-semibold text-stone-900">{{ weekRangeLabel() }}</p>
          @if (!isCurrentWeek()) {
            <button
              type="button"
              class="mt-0.5 text-xs font-medium text-brand-700 hover:text-brand-800"
              (click)="onTodayWeek()"
            >
              Jump to this week
            </button>
          }
        </div>

        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50"
          aria-label="Next week"
          (click)="onNextWeek()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <!-- Horizontal day picker -->
      <div class="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div class="mx-auto flex w-fit justify-center gap-2">
        @for (date of mealPlanService.weekDates(); track date) {
          @let day = formatDayShort(date);
          @let mealCount = mealsForDate(date);
          <button
            type="button"
            class="flex min-w-[3.25rem] flex-col items-center rounded-xl px-3 py-2.5 transition-colors"
            [class.bg-brand-600]="selectedDate() === date"
            [class.text-white]="selectedDate() === date"
            [class.bg-stone-100]="selectedDate() !== date"
            [class.text-stone-700]="selectedDate() !== date"
            [class.ring-2]="isTodayDate(date) && selectedDate() !== date"
            [class.ring-brand-600]="isTodayDate(date) && selectedDate() !== date"
            [class.ring-offset-1]="isTodayDate(date) && selectedDate() !== date"
            (click)="selectDate(date)"
          >
            <span class="text-xs font-medium">{{ day.weekday }}</span>
            <span class="mt-0.5 text-lg font-semibold leading-none">{{ day.day }}</span>
            <span class="mt-1.5 flex h-1.5 items-center justify-center gap-0.5" aria-hidden="true">
              @for (dot of mealCountDots(mealCount); track $index) {
                <span
                  class="h-1 w-1 rounded-full"
                  [class.bg-white/80]="selectedDate() === date"
                  [class.bg-brand-600]="selectedDate() !== date"
                ></span>
              }
            </span>
          </button>
        }
        </div>
      </div>

      @if (!mealPlanService.loading() && !mealPlanService.error()) {
        <!-- Week summary stats -->
        <div class="grid grid-cols-3 gap-3 sm:gap-4">
          <app-stat-card
            label="Meals planned"
            icon="basket"
            variant="success"
            [value]="weekStats().mealsPlanned"
          />
          <app-stat-card
            label="Ingredients ready"
            icon="clock"
            variant="warning"
            [value]="weekStats().ingredientsReadyPercent !== null ? weekStats().ingredientsReadyPercent! + '%' : '—'"
          />
          <app-stat-card
            label="Items needed"
            icon="warning"
            variant="danger"
            [value]="weekStats().itemsNeeded"
          />
        </div>
      }

      @if (selectedSlot()) {
        <app-meal-plan-recipe-picker
          [date]="selectedSlot()!.date"
          [mealType]="selectedSlot()!.mealType"
          (selected)="onRecipeSelected($event)"
          (cancelled)="selectedSlot.set(null)"
        />
      }

      @if (mealPlanService.loading()) {
        <app-loading-state message="Loading meal plan..." />
      } @else if (mealPlanService.error()) {
        <p class="alert-error">
          {{ mealPlanService.error() }}
        </p>
      } @else {
        <!-- Selected day meals -->
        <div>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-stone-900">{{ selectedDayHeading() }}</h2>
            @if (isTodayDate(selectedDate())) {
              <span class="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Today</span>
            }
          </div>

          <div class="space-y-6">
            @for (mealType of mealTypes; track mealType) {
              <section>
                <div class="mb-3">
                  <h3 class="text-base font-semibold text-stone-900">{{ mealTypeLabel(mealType) }}</h3>
                  <p class="text-sm text-stone-600">{{ mealTypeTimeRange(mealType) }}</p>
                </div>

                @if (entryFor(selectedDate(), mealType); as entry) {
                  @let availability = entryAvailability(entry);
                  <article class="card relative overflow-hidden p-4">
                    @if (availability.variant === 'ready') {
                      <div
                        class="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                        aria-label="All ingredients ready"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="h-4 w-4">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                    }

                    <div class="flex gap-3 pr-8">
                      <div
                        class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                        [class]="mealTypeIconStyles(mealType)"
                      >
                        <ng-container *ngTemplateOutlet="mealTypeIcon; context: { mealType }" />
                      </div>

                      <div class="min-w-0 flex-1">
                        <p class="font-semibold text-stone-900">{{ entry.recipe?.title ?? 'Recipe unavailable' }}</p>
                        @if (entry.recipe?.prep_time_minutes) {
                          <p class="mt-1 flex items-center gap-1 text-sm text-stone-600">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            {{ entry.recipe!.prep_time_minutes }} min
                          </p>
                        }
                        <span
                          class="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                          [class.bg-brand-50]="availability.variant === 'ready'"
                          [class.text-brand-700]="availability.variant === 'ready'"
                          [class.bg-amber-50]="availability.variant === 'partial'"
                          [class.text-amber-700]="availability.variant === 'partial'"
                          [class.bg-stone-100]="availability.variant === 'empty'"
                          [class.text-stone-600]="availability.variant === 'empty'"
                        >
                          {{ availability.label }}
                        </span>
                      </div>
                    </div>

                    <div class="mt-4 flex gap-2">
                      @if (entry.recipe_id) {
                        <a
                          [routerLink]="['/recipes', entry.recipe_id]"
                          class="btn-primary flex-1 text-center"
                        >
                          View recipe
                        </a>
                      }
                      <button
                        type="button"
                        class="btn-secondary"
                        [disabled]="removingId() === entry.id"
                        (click)="onRemove(entry.id, entry.recipe?.title ?? 'this meal')"
                      >
                        {{ removingId() === entry.id ? 'Removing...' : 'Remove' }}
                      </button>
                    </div>
                  </article>
                } @else {
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/30"
                    (click)="openPicker(selectedDate(), mealType)"
                  >
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-stone-200">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 text-stone-400">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-stone-600">No meal planned</p>
                      <p class="text-sm font-semibold text-brand-700">Tap to add a recipe</p>
                    </div>
                  </button>
                }
              </section>
            }
          </div>
        </div>

        <div class="flex justify-center pt-2">
          <button
            type="button"
            class="text-sm font-medium text-stone-500 transition-colors hover:text-brand-700 disabled:opacity-50"
            [disabled]="duplicating()"
            (click)="onDuplicatePreviousWeek()"
          >
            {{ duplicating() ? 'Copying last week...' : 'Duplicate previous week' }}
          </button>
        </div>
      }
    </div>

    <ng-template #mealTypeIcon let-mealType="mealType">
      @switch (mealType) {
        @case ('breakfast') {
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75M9.75 4.5h4.5M6 9.75h12M6 9.75v7.125c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.75" />
          </svg>
        }
        @case ('lunch') {
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
        }
        @case ('dinner') {
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.38a48.474 48.474 0 0 0-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12" />
          </svg>
        }
        @case ('snack') {
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c-2 2-2.5 3.5-2.5 5 0 1.8 1 3.2 2.2 4.2-.7 1-1.2 2.3-1.2 3.8 0 2.8 2.2 5 5 5s5-2.2 5-5c0-1.5-.5-2.8-1.2-3.8 1.2-1 2.2-2.4 2.2-4.2 0-1.5-.5-3-2.5-5" />
          </svg>
        }
      }
    </ng-template>
  `,
})
export class MealPlanComponent implements OnInit {
  readonly mealPlanService = inject(MealPlanService);
  private readonly recipeService = inject(RecipeService);
  private readonly inventoryService = inject(FoodInventoryService);

  readonly mealTypes = MEAL_TYPES;
  readonly selectedSlot = signal<SelectedSlot | null>(null);
  readonly selectedDate = signal(toISODate(new Date()));
  readonly removingId = signal<string | null>(null);
  readonly duplicating = signal(false);

  readonly weekRangeLabel = computed(() =>
    formatWeekRangeCompact(this.mealPlanService.weekDates())
  );

  readonly selectedDayHeading = computed(() => formatFullDayHeading(this.selectedDate()));

  readonly weekStats = computed((): WeekStats => {
    const inventory = this.inventoryService.items();
    const recipes = this.recipeService.recipes();
    let mealsPlanned = 0;
    let totalIngredients = 0;
    let availableIngredients = 0;
    const missingNames = new Set<string>();

    for (const entry of this.mealPlanService.entries()) {
      if (!entry.recipe_id) {
        continue;
      }

      mealsPlanned += 1;
      const recipe = recipes.find((item) => item.id === entry.recipe_id);
      const ingredients = recipe?.ingredients ?? [];
      const availability = getIngredientAvailability(ingredients, inventory);

      totalIngredients += availability.total;
      availableIngredients += availability.available;

      if (recipe?.ingredients) {
        const inventoryNames = inventory.map((item) => item.name.toLowerCase().trim());
        for (const ingredient of recipe.ingredients) {
          const name = ingredient.name.toLowerCase().trim();
          const hasMatch = inventoryNames.some(
            (inventoryName) => inventoryName.includes(name) || name.includes(inventoryName)
          );
          if (!hasMatch) {
            missingNames.add(name);
          }
        }
      }
    }

    return {
      mealsPlanned,
      ingredientsReadyPercent:
        totalIngredients > 0
          ? Math.round((availableIngredients / totalIngredients) * 100)
          : null,
      itemsNeeded: missingNames.size,
    };
  });

  ngOnInit(): void {
    void Promise.all([
      this.mealPlanService.loadWeekAndToday(),
      this.recipeService.loadRecipes(),
      this.inventoryService.loadItems(),
    ]).then(() => {
      this.syncSelectedDateToWeek();
    });
  }

  formatDayShort = formatDayShort;

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  mealTypeTimeRange(mealType: MealType): string {
    return MEAL_TYPE_TIME_RANGES[mealType];
  }

  isTodayDate(date: string): boolean {
    return isToday(date);
  }

  isCurrentWeek(): boolean {
    const today = toISODate(new Date());
    return this.mealPlanService.weekDates().includes(today);
  }

  entryFor(date: string, mealType: MealType): MealPlanEntry | undefined {
    return this.mealPlanService.getEntryForSlot(date, mealType);
  }

  mealsForDate(date: string): number {
    return this.mealTypes.filter((mealType) => this.entryFor(date, mealType)).length;
  }

  mealCountDots(count: number): number[] {
    return Array.from({ length: Math.min(count, 3) }, (_, index) => index);
  }

  selectDate(date: string): void {
    this.selectedDate.set(date);
    this.selectedSlot.set(null);
  }

  entryAvailability(entry: MealPlanEntry): IngredientAvailability {
    const recipe = this.recipeService.recipes().find((item) => item.id === entry.recipe_id);
    return getIngredientAvailability(recipe?.ingredients ?? [], this.inventoryService.items());
  }

  mealTypeIconStyles(mealType: MealType): string {
    const styles: Record<MealType, string> = {
      breakfast: 'bg-amber-50 text-amber-600',
      lunch: 'bg-brand-50 text-brand-600',
      dinner: 'bg-emerald-50 text-emerald-600',
      snack: 'bg-violet-50 text-violet-600',
    };
    return styles[mealType];
  }

  openPicker(date: string, mealType: MealType): void {
    this.selectedSlot.set({ date, mealType });
  }

  async onRecipeSelected(recipeId: string): Promise<void> {
    const slot = this.selectedSlot();
    if (!slot) {
      return;
    }

    const { error } = await this.mealPlanService.assignRecipeToMeal(
      slot.date,
      slot.mealType,
      recipeId
    );

    if (!error) {
      this.selectedSlot.set(null);
      await this.mealPlanService.getTodayMeals();
    }
  }

  async onRemove(id: string, title: string): Promise<void> {
    if (!window.confirm(`Remove "${title}" from this meal slot?`)) {
      return;
    }

    this.removingId.set(id);
    await this.mealPlanService.removeMealPlanEntry(id);
    this.removingId.set(null);
    await this.mealPlanService.getTodayMeals();
  }

  async onPreviousWeek(): Promise<void> {
    this.mealPlanService.goToPreviousWeek();
    this.selectedSlot.set(null);
    await this.mealPlanService.getMealPlanForWeek(this.mealPlanService.weekStart());
    this.syncSelectedDateToWeek();
  }

  async onNextWeek(): Promise<void> {
    this.mealPlanService.goToNextWeek();
    this.selectedSlot.set(null);
    await this.mealPlanService.getMealPlanForWeek(this.mealPlanService.weekStart());
    this.syncSelectedDateToWeek();
  }

  async onTodayWeek(): Promise<void> {
    this.mealPlanService.goToTodayWeek();
    this.selectedSlot.set(null);
    await this.mealPlanService.loadWeekAndToday();
    this.selectedDate.set(toISODate(new Date()));
  }

  async onDuplicatePreviousWeek(): Promise<void> {
    if (
      !window.confirm(
        "Copy last week's meals into empty slots for this week? Existing meals will not be overwritten."
      )
    ) {
      return;
    }

    this.duplicating.set(true);
    const { copiedCount, error } = await this.mealPlanService.duplicatePreviousWeek(
      this.mealPlanService.weekStart()
    );
    this.duplicating.set(false);

    if (!error && copiedCount === 0) {
      window.alert('No empty slots were available to copy into.');
    }
  }

  private syncSelectedDateToWeek(): void {
    const weekDates = this.mealPlanService.weekDates();
    const current = this.selectedDate();

    if (weekDates.includes(current)) {
      return;
    }

    const today = toISODate(new Date());
    this.selectedDate.set(weekDates.includes(today) ? today : weekDates[0]);
  }
}
