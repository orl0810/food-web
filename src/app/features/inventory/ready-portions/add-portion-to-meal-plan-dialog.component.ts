import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { PreparedPortion } from '../../../core/models/prepared-portion.model';
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  MealType,
} from '../../../core/models/meal-plan.model';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import {
  formatDayLabel,
  getUpcomingDates,
  toISODate,
} from '../../../shared/utils/meal-plan.utils';
import { isPortionExpired } from '../../../shared/utils/prepared-portion.utils';

@Component({
  selector: 'app-add-portion-to-meal-plan-dialog',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      (click)="cancelled.emit()"
    >
      <div class="card w-full max-w-md p-5" (click)="$event.stopPropagation()">
        <h2 class="text-base font-semibold text-stone-900">Add to meal plan</h2>
        <p class="mt-1 text-sm text-stone-600">{{ portion().name }}</p>
        <p class="mt-0.5 text-xs text-stone-500">
          {{ portion().available_portions }} portion{{ portion().available_portions === 1 ? '' : 's' }} available
        </p>

        @if (expiredWarning()) {
          <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This portion has expired. Use anyway?
          </p>
        }

        <div class="mt-4 space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-stone-700">Portions to use</label>
            <input
              type="number"
              min="1"
              [max]="portion().available_portions"
              class="input w-full"
              [value]="portionsUsed()"
              (input)="onPortionsInput($event)"
            />
          </div>

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
            {{ saving() ? 'Adding...' : (expiredWarning() && !confirmExpired() ? 'Use anyway' : 'Add to plan') }}
          </button>
          <button type="button" class="btn-secondary flex-1" [disabled]="saving()" (click)="cancelled.emit()">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AddPortionToMealPlanDialogComponent implements OnInit {
  private readonly mealPlanService = inject(MealPlanService);

  readonly portion = input.required<PreparedPortion>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly mealTypes = MEAL_TYPES;
  readonly weekDates = getUpcomingDates(7);

  readonly selectedDate = signal(toISODate());
  readonly selectedMealType = signal<MealType>('lunch');
  readonly portionsUsed = signal(1);
  readonly confirmExpired = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly expiredWarning = () => isPortionExpired(this.portion());

  ngOnInit(): void {
    this.selectedDate.set(toISODate());
  }

  onPortionsInput(event: Event): void {
    const value = Math.max(1, parseInt((event.target as HTMLInputElement).value, 10) || 1);
    this.portionsUsed.set(Math.min(value, this.portion().available_portions));
  }

  dayLabel(date: string): string {
    return formatDayLabel(date);
  }

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  async confirm(): Promise<void> {
    if (this.expiredWarning() && !this.confirmExpired()) {
      this.confirmExpired.set(true);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const { error } = await this.mealPlanService.addSlotItem({
      date: this.selectedDate(),
      meal_type: this.selectedMealType(),
      item_type: 'prepared_portion',
      prepared_portion_id: this.portion().id,
      portions_used: this.portionsUsed(),
      allow_expired: this.confirmExpired(),
    });

    this.saving.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    this.saved.emit();
  }
}
