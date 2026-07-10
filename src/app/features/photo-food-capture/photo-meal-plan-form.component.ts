import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MealSlotItemStatus } from '../../core/models/meal-slot-item.model';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MealType,
} from '../../core/models/meal-plan.model';
import { PhotoCaptureContext } from '../../core/models/photo-food-capture.model';
import { FoodLogPhotoService } from '../../core/services/food-log-photo.service';
import { FoodLogService } from '../../core/services/food-log.service';
import { getDefaultMealTypeForNow } from '../../shared/utils/food-log.utils';
import {
  formatDayLabel,
  getUpcomingDates,
  isPastDate,
  isToday,
  toISODate,
} from '../../shared/utils/meal-plan.utils';

type DisplayStatus = 'planned' | 'ready' | 'consumed';

const STATUS_OPTIONS: { id: DisplayStatus; label: string; dbStatus: MealSlotItemStatus }[] = [
  { id: 'planned', label: 'Planned', dbStatus: 'planned' },
  { id: 'ready', label: 'Ready', dbStatus: 'prepared' },
  { id: 'consumed', label: 'Consumed', dbStatus: 'eaten' },
];

@Component({
  selector: 'app-photo-meal-plan-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-meal-plan-title"
      (click)="cancelled.emit()"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="border-b border-stone-100 p-4">
          <h2 id="photo-meal-plan-title" class="text-base font-semibold text-stone-900">
            Add to meal plan
          </h2>
          <p class="mt-0.5 text-sm text-stone-600">Plan this meal for a day and slot.</p>
        </div>

        <form class="flex-1 space-y-4 overflow-y-auto p-4" [formGroup]="form">
          @if (uploadError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ uploadError() }}</p>
          }
          @if (saveError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ saveError() }}</p>
          }

          @if (previewUrl()) {
            <img
              [src]="previewUrl()!"
              alt="Selected food photo preview"
              class="h-32 w-full rounded-lg object-cover"
            />
          }

          <div>
            <label for="photo-plan-name" class="mb-1 block text-sm font-medium text-stone-700">
              Food / meal name
            </label>
            <input
              id="photo-plan-name"
              type="text"
              class="input w-full"
              formControlName="name"
              placeholder="Chicken stir-fry"
            />
          </div>

          <fieldset>
            <legend class="mb-2 block text-sm font-medium text-stone-700">Day</legend>
            <div class="flex flex-wrap gap-2">
              @for (date of weekDates; track date) {
                <button
                  type="button"
                  class="filter-pill"
                  [class.filter-pill-active]="form.controls.date.value === date"
                  [class.filter-pill-inactive]="form.controls.date.value !== date"
                  (click)="selectDate(date)"
                >
                  {{ dayLabel(date) }}
                </button>
              }
            </div>
          </fieldset>

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

          <fieldset>
            <legend class="mb-2 block text-sm font-medium text-stone-700">Status</legend>
            <div class="flex flex-wrap gap-2">
              @for (status of statusOptions; track status.id) {
                <button
                  type="button"
                  class="filter-pill"
                  [class.filter-pill-active]="selectedStatus() === status.id"
                  [class.filter-pill-inactive]="selectedStatus() !== status.id"
                  [disabled]="isStatusDisabled(status.id)"
                  (click)="selectStatus(status.id)"
                >
                  {{ status.label }}
                </button>
              }
            </div>
            @if (isFutureDate()) {
              <p class="mt-1 text-xs text-stone-500">Future meals are saved as planned.</p>
            }
          </fieldset>

          <div>
            <label for="photo-plan-notes" class="mb-1 block text-sm font-medium text-stone-700">
              Notes (optional)
            </label>
            <textarea id="photo-plan-notes" rows="2" class="input w-full" formControlName="notes"></textarea>
          </div>
        </form>

        <div class="flex gap-3 border-t border-stone-100 p-4">
          <button type="button" class="btn-secondary flex-1" (click)="cancelled.emit()">Cancel</button>
          <button
            type="button"
            class="btn-primary flex-1"
            [disabled]="form.invalid || saving()"
            (click)="save()"
          >
            {{ saving() ? 'Saving...' : 'Add to plan' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PhotoMealPlanFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly foodLogService = inject(FoodLogService);
  private readonly photoService = inject(FoodLogPhotoService);

  readonly file = input.required<File>();
  readonly previewUrl = input.required<string>();
  readonly context = input<PhotoCaptureContext>({});
  readonly suggestedName = input<string | null>(null);

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly mealTypes = MEAL_TYPES;
  readonly mealTypeLabels = MEAL_TYPE_LABELS;
  readonly statusOptions = STATUS_OPTIONS;
  readonly weekDates = getUpcomingDates(7);
  readonly today = toISODate(new Date());

  readonly saving = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly selectedStatus = signal<DisplayStatus>('planned');

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    date: [this.today, Validators.required],
    mealType: [getDefaultMealTypeForNow() as MealType, Validators.required],
    notes: [''],
  });

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');

    const ctx = this.context();
    if (ctx.defaultDate) {
      this.form.controls.date.setValue(ctx.defaultDate);
    }
    if (ctx.defaultMealType) {
      this.form.controls.mealType.setValue(ctx.defaultMealType);
    }

    const suggested = this.suggestedName()?.trim();
    if (suggested) {
      this.form.controls.name.setValue(suggested);
    }

    this.applyStatusDefaults();
    this.form.controls.date.valueChanges.subscribe(() => this.applyStatusDefaults());
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
  }

  dayLabel(date: string): string {
    return formatDayLabel(date);
  }

  selectDate(date: string): void {
    this.form.controls.date.setValue(date);
  }

  selectStatus(status: DisplayStatus): void {
    if (this.isStatusDisabled(status)) {
      return;
    }
    this.selectedStatus.set(status);
  }

  isFutureDate(): boolean {
    const date = this.form.controls.date.value;
    return !isToday(date) && !isPastDate(date);
  }

  isStatusDisabled(status: DisplayStatus): boolean {
    if (this.isFutureDate()) {
      return status !== 'planned';
    }
    if (status === 'consumed' && isPastDate(this.form.controls.date.value)) {
      return true;
    }
    return false;
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.uploadError.set(null);
    this.saveError.set(null);

    let imageUrl: string;
    try {
      imageUrl = await this.photoService.uploadFoodPhoto(this.file());
    } catch (err) {
      this.saving.set(false);
      this.uploadError.set(
        err instanceof Error ? err.message : 'We could not upload the photo. Please try again.'
      );
      return;
    }

    const value = this.form.getRawValue();
    const dbStatus = this.resolveDbStatus();

    const { error } = await this.foodLogService.createPhotoFoodLog({
      name: value.name,
      date: value.date,
      mealType: value.mealType,
      notes: value.notes || null,
      imageUrl,
      status: dbStatus,
    });

    this.saving.set(false);

    if (error) {
      this.saveError.set(error);
      return;
    }

    this.saved.emit();
  }

  private applyStatusDefaults(): void {
    if (this.isFutureDate()) {
      this.selectedStatus.set('planned');
      return;
    }
    if (isToday(this.form.controls.date.value)) {
      this.selectedStatus.set('ready');
    }
  }

  private resolveDbStatus(): MealSlotItemStatus {
    if (this.isFutureDate()) {
      return 'planned';
    }
    const match = STATUS_OPTIONS.find((option) => option.id === this.selectedStatus());
    return match?.dbStatus ?? 'planned';
  }
}
