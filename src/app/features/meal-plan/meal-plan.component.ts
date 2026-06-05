import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MealType,
} from '../../core/models/meal-plan.model';
import { MealPlanService } from '../../core/services/meal-plan.service';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import {
  formatDayLabel,
  formatWeekRange,
  isToday,
} from '../../shared/utils/meal-plan.utils';
import { MealPlanRecipePickerComponent } from './meal-plan-recipe-picker.component';

interface SelectedSlot {
  date: string;
  mealType: MealType;
}

@Component({
  selector: 'app-meal-plan',
  standalone: true,
  imports: [RouterLink, LoadingStateComponent, MealPlanRecipePickerComponent],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-stone-900">Meal Plan</h1>
        <p class="mt-1 text-sm text-stone-600">Plan your week by assigning recipes to each meal.</p>
      </div>

      <section class="rounded-xl border border-stone-200 bg-card p-5 shadow-sm">
        <h2 class="text-base font-semibold text-stone-900">Today&apos;s meals</h2>
        <div class="mt-4 space-y-3">
          @for (mealType of mealTypes; track mealType) {
            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span class="text-sm font-medium text-stone-700">{{ mealTypeLabel(mealType) }}</span>
              @if (todayMealTitle(mealType); as title) {
                <a
                  [routerLink]="['/recipes', todayMealRecipeId(mealType)]"
                  class="text-sm font-medium text-brand-700 hover:text-brand-800"
                >
                  {{ title }}
                </a>
              } @else {
                <span class="text-sm text-stone-500">No meal planned yet.</span>
              }
            </div>
          }
        </div>
      </section>

      <div class="flex flex-col gap-4 rounded-xl border border-stone-200 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-medium text-stone-500">Week of</p>
          <p class="text-lg font-semibold text-stone-900">{{ weekRangeLabel() }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            (click)="onPreviousWeek()"
          >
            Previous
          </button>
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            (click)="onTodayWeek()"
          >
            Today
          </button>
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            (click)="onNextWeek()"
          >
            Next
          </button>
          <button
            type="button"
            class="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            [disabled]="duplicating()"
            (click)="onDuplicatePreviousWeek()"
          >
            {{ duplicating() ? 'Copying...' : 'Duplicate previous week' }}
          </button>
        </div>
      </div>

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
        <p class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ mealPlanService.error() }}
        </p>
      } @else {
        <div class="grid gap-4 lg:grid-cols-7">
          @for (date of mealPlanService.weekDates(); track date) {
            <div
              class="rounded-xl border bg-card p-4 shadow-sm"
              [class.border-brand-300]="isTodayDate(date)"
              [class.bg-brand-50/30]="isTodayDate(date)"
              [class.border-stone-200]="!isTodayDate(date)"
            >
              <div class="flex items-baseline justify-between gap-2">
                <h3 class="text-sm font-semibold text-stone-900 lg:text-base">
                  {{ formatDayLabel(date) }}
                </h3>
                @if (isTodayDate(date)) {
                  <span class="text-xs font-medium text-brand-700">Today</span>
                }
              </div>

              <div class="mt-4 space-y-3">
                @for (mealType of mealTypes; track mealType) {
                  <div class="rounded-lg border border-stone-200 bg-white p-3">
                    <div class="flex items-start justify-between gap-2">
                      <p class="text-xs font-semibold uppercase tracking-wide text-stone-500">
                        {{ mealTypeLabel(mealType) }}
                      </p>
                      @if (entryFor(date, mealType); as entry) {
                        <button
                          type="button"
                          class="text-xs font-medium text-red-600 hover:text-red-700"
                          [disabled]="removingId() === entry.id"
                          (click)="onRemove(entry.id, entry.recipe?.title ?? 'this meal')"
                        >
                          Remove
                        </button>
                      }
                    </div>

                    @if (entryFor(date, mealType); as entry) {
                      <button
                        type="button"
                        class="mt-2 w-full text-left text-sm font-medium text-brand-700 hover:text-brand-800"
                        (click)="openPicker(date, mealType)"
                      >
                        {{ entry.recipe?.title ?? 'Recipe unavailable' }}
                      </button>
                      <button
                        type="button"
                        class="mt-2 text-xs font-medium text-stone-600 hover:text-stone-800"
                        (click)="openPicker(date, mealType)"
                      >
                        Change recipe
                      </button>
                    } @else {
                      <p class="mt-2 text-sm text-stone-500">Choose a recipe for this meal.</p>
                      <button
                        type="button"
                        class="mt-2 text-sm font-medium text-brand-700 hover:text-brand-800"
                        (click)="openPicker(date, mealType)"
                      >
                        Assign recipe
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MealPlanComponent implements OnInit {
  readonly mealPlanService = inject(MealPlanService);

  readonly mealTypes = MEAL_TYPES;
  readonly selectedSlot = signal<SelectedSlot | null>(null);
  readonly removingId = signal<string | null>(null);
  readonly duplicating = signal(false);

  readonly weekRangeLabel = computed(() =>
    formatWeekRange(this.mealPlanService.weekDates())
  );

  ngOnInit(): void {
    void this.mealPlanService.loadWeekAndToday();
  }

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  formatDayLabel(date: string): string {
    return formatDayLabel(date);
  }

  isTodayDate(date: string): boolean {
    return isToday(date);
  }

  entryFor(date: string, mealType: MealType) {
    return this.mealPlanService.getEntryForSlot(date, mealType);
  }

  todayMealTitle(mealType: MealType): string | null {
    return this.mealPlanService.todaysMeals().get(mealType)?.recipe?.title ?? null;
  }

  todayMealRecipeId(mealType: MealType): string | null {
    return this.mealPlanService.todaysMeals().get(mealType)?.recipe_id ?? null;
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
  }

  async onNextWeek(): Promise<void> {
    this.mealPlanService.goToNextWeek();
    this.selectedSlot.set(null);
    await this.mealPlanService.getMealPlanForWeek(this.mealPlanService.weekStart());
  }

  async onTodayWeek(): Promise<void> {
    this.mealPlanService.goToTodayWeek();
    this.selectedSlot.set(null);
    await this.mealPlanService.loadWeekAndToday();
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
}
