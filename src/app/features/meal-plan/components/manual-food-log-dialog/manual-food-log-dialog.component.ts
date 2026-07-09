import { Component, OnDestroy, OnInit, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType } from '../../../../core/models/meal-plan.model';
import { FoodLogService } from '../../../../core/services/food-log.service';
import { toISODate } from '../../../../shared/utils/meal-plan.utils';
import { getDefaultMealTypeForNow } from '../../../../shared/utils/food-log.utils';

@Component({
  selector: 'app-manual-food-log-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-food-log-title"
      (click)="cancelled.emit()"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="border-b border-stone-100 p-4">
          <h2 id="manual-food-log-title" class="text-base font-semibold text-stone-900">Log food manually</h2>
          <p class="mt-0.5 text-sm text-stone-600">Quickly record something you ate.</p>
        </div>

        <form class="flex-1 space-y-4 overflow-y-auto p-4" [formGroup]="form" (ngSubmit)="save()">
          @if (error()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {{ error() }}
            </p>
          }

          <div>
            <label for="food-name" class="mb-1 block text-sm font-medium text-stone-700">Food name</label>
            <input id="food-name" type="text" class="input w-full" formControlName="name" placeholder="Greek yogurt with honey" />
          </div>

          <fieldset>
            <legend class="mb-2 block text-sm font-medium text-stone-700">Meal slot</legend>
            <div class="flex flex-wrap gap-2">
              @for (mealType of mealTypes; track mealType) {
                <button
                  type="button"
                  class="filter-pill"
                  [class.filter-pill-active]="form.controls.mealType.value === mealType"
                  [class.filter-pill-inactive]="form.controls.mealType.value !== mealType"
                  (click)="form.controls.mealType.setValue(mealType)"
                >
                  {{ mealTypeLabels[mealType] }}
                </button>
              }
            </div>
          </fieldset>

          <div>
            <label for="food-date" class="mb-1 block text-sm font-medium text-stone-700">Date</label>
            <input id="food-date" type="date" class="input w-full" formControlName="date" [max]="today" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="food-quantity" class="mb-1 block text-sm font-medium text-stone-700">Quantity (optional)</label>
              <input id="food-quantity" type="number" min="0" step="any" class="input w-full" formControlName="quantity" />
            </div>
            <div>
              <label for="food-unit" class="mb-1 block text-sm font-medium text-stone-700">Unit (optional)</label>
              <input id="food-unit" type="text" class="input w-full" formControlName="unit" placeholder="bowl, slice..." />
            </div>
          </div>

          <div>
            <label for="food-notes" class="mb-1 block text-sm font-medium text-stone-700">Notes (optional)</label>
            <textarea id="food-notes" rows="2" class="input w-full" formControlName="notes"></textarea>
          </div>

          <label class="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" formControlName="markAsConsumed" class="rounded border-stone-300 text-brand-600" />
            Mark as consumed
          </label>
        </form>

        <div class="flex gap-3 border-t border-stone-100 p-4">
          <button type="button" class="btn-secondary flex-1" (click)="cancelled.emit()">Cancel</button>
          <button
            type="button"
            class="btn-primary flex-1"
            [disabled]="form.invalid || saving()"
            (click)="save()"
          >
            {{ saving() ? 'Saving...' : 'Save food log' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ManualFoodLogDialogComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly foodLogService = inject(FoodLogService);

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly mealTypes = MEAL_TYPES;
  readonly mealTypeLabels = MEAL_TYPE_LABELS;
  readonly today = toISODate(new Date());
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    mealType: [getDefaultMealTypeForNow() as MealType, Validators.required],
    date: [this.today, Validators.required],
    quantity: [null as number | null],
    unit: [''],
    notes: [''],
    markAsConsumed: [true],
  });

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();
    const { error } = await this.foodLogService.createManualFoodLog({
      name: value.name,
      date: value.date,
      mealType: value.mealType,
      quantity: value.quantity,
      unit: value.unit || null,
      notes: value.notes || null,
      markAsConsumed: value.markAsConsumed,
    });

    this.saving.set(false);

    if (error) {
      this.error.set("We couldn't save this food log. Please try again.");
      return;
    }

    this.saved.emit();
  }
}
