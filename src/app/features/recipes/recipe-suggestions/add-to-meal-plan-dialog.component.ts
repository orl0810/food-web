import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  MealType,
} from '../../../core/models/meal-plan.model';
import { Recipe } from '../../../core/models/recipe.model';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import {
  formatDayLabel,
  getUpcomingDates,
  toISODate,
} from '../../../shared/utils/meal-plan.utils';

@Component({
  selector: 'app-add-to-meal-plan-dialog',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-dialog flex items-center justify-center overflow-y-auto bg-stone-900/40 p-4"
      (click)="cancelled.emit()"
    >
      <div
        class="card my-auto w-full max-w-md p-5"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-base font-semibold text-stone-900">Add to meal plan</h2>
        <p class="mt-1 text-sm text-stone-600">{{ recipe().title }}</p>

        <div class="mt-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-stone-700">Day</label>
            <div class="mt-1.5 flex flex-wrap gap-2">
              @for (date of weekDates; track date) {
                <button
                  type="button"
                  class="filter-pill"
                  [class.filter-pill-active]="selectedDate() === date"
                  [class.filter-pill-inactive]="selectedDate() !== date"
                  (click)="selectedDate.set(date)"
                >
                  {{ dayLabel(date) }}
                </button>
              }
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700">Meal</label>
            <div class="mt-1.5 flex flex-wrap gap-2">
              @for (mealType of mealTypes; track mealType) {
                <button
                  type="button"
                  class="filter-pill"
                  [class.filter-pill-active]="selectedMealType() === mealType"
                  [class.filter-pill-inactive]="selectedMealType() !== mealType"
                  (click)="selectedMealType.set(mealType)"
                >
                  {{ mealTypeLabel(mealType) }}
                </button>
              }
            </div>
          </div>
        </div>

        @if (error()) {
          <p class="alert-error mt-4">{{ error() }}</p>
        }

        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="btn-primary flex-1"
            [disabled]="saving()"
            (click)="confirm()"
          >
            {{ saving() ? 'Adding...' : 'Add to plan' }}
          </button>
          <button
            type="button"
            class="btn-secondary flex-1"
            [disabled]="saving()"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AddToMealPlanDialogComponent implements OnInit {
  private readonly mealPlanService = inject(MealPlanService);

  readonly recipe = input.required<Recipe>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly mealTypes = MEAL_TYPES;
  readonly weekDates = getUpcomingDates(7);

  readonly selectedDate = signal(toISODate());
  readonly selectedMealType = signal<MealType>('dinner');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.selectedDate.set(toISODate());
  }

  dayLabel(date: string): string {
    return formatDayLabel(date);
  }

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  async confirm(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);

    const { error } = await this.mealPlanService.addSlotItem({
      date: this.selectedDate(),
      meal_type: this.selectedMealType(),
      item_type: 'recipe',
      recipe_id: this.recipe().id,
    });

    this.saving.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    this.saved.emit();
  }
}
