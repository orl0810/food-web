import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MealSlotItemStatus } from '../../core/models/meal-slot-item.model';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MealType,
} from '../../core/models/meal-plan.model';
import {
  MealPhotoDraft,
  MealPhotoDraftFormValue,
} from '../../core/models/meal-photo-analysis.model';
import { PhotoCaptureContext } from '../../core/models/photo-food-capture.model';
import { FoodLogPhotoService } from '../../core/services/food-log-photo.service';
import { FoodLogService } from '../../core/services/food-log.service';
import { MealPhotoAnalysisService } from '../../core/services/meal-photo-analysis.service';
import {
  buildConfirmedPayload,
  draftToFormValue,
  formValueToPhotoFoodLogInput,
  getConfidenceLabel,
  getConfidenceLevel,
  shouldHighlightField,
} from '../../shared/utils/meal-photo-draft.utils';
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
  selector: 'app-meal-photo-draft-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 z-overlay flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meal-photo-draft-title"
      (click)="cancelled.emit()"
    >
      <div
        class="card flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="border-b border-stone-100 p-4">
          <h2 id="meal-photo-draft-title" class="text-base font-semibold text-stone-900">
            Review meal draft
          </h2>
          <p class="mt-0.5 text-sm text-stone-600">
            Food quantities and nutrition are estimated from the photo. Review the details before adding this meal.
          </p>
        </div>

        <form class="flex-1 space-y-4 overflow-y-auto p-4" [formGroup]="form" (ngSubmit)="save()">
          @if (saveError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {{ saveError() }}
            </p>
          }
          @if (uploadError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {{ uploadError() }}
            </p>
          }

          @if (previewUrl()) {
            <img
              [src]="previewUrl()!"
              alt="Analyzed food photo preview"
              class="h-32 w-full rounded-lg object-cover"
            />
          }

          <div>
            <label for="draft-title" class="mb-1 block text-sm font-medium text-stone-700">
              Meal title *
            </label>
            <input id="draft-title" type="text" class="input w-full" formControlName="title" />
          </div>

          <fieldset>
            <legend class="mb-2 block text-sm font-medium text-stone-700">Day *</legend>
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
            <legend class="mb-2 block text-sm font-medium text-stone-700">Meal slot *</legend>
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
            <label for="draft-eaten-at" class="mb-1 block text-sm font-medium text-stone-700">
              Eaten time (optional)
            </label>
            <input id="draft-eaten-at" type="time" class="input w-full" formControlName="eatenAt" />
          </div>

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
            <div class="mb-2 flex items-center justify-between gap-2">
              <h3 class="text-sm font-semibold text-stone-900">Detected foods *</h3>
              <button type="button" class="text-sm font-medium text-brand-700" (click)="addItem()">
                Add item
              </button>
            </div>
            <div class="space-y-3" formArrayName="items">
              @for (itemGroup of items.controls; track itemGroup; let i = $index) {
                <div
                  class="rounded-lg border p-3"
                  [class.border-amber-300]="shouldHighlightItem(i)"
                  [class.bg-amber-50/40]="shouldHighlightItem(i)"
                  [class.border-stone-200]="!shouldHighlightItem(i)"
                  [formGroupName]="i"
                >
                  <div class="mb-2 flex items-start justify-between gap-2">
                    <span class="text-xs font-medium text-stone-600">
                      {{ confidenceLabel(i) }}
                    </span>
                    @if (items.length > 1) {
                      <button
                        type="button"
                        class="text-xs font-medium text-red-700"
                        (click)="removeItem(i)"
                      >
                        Remove
                      </button>
                    }
                  </div>
                  <div class="space-y-2">
                    <input type="text" class="input w-full" formControlName="name" placeholder="Food name" />
                    <div class="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        class="input w-full"
                        formControlName="quantity"
                        placeholder="Qty"
                      />
                      <input type="text" class="input w-full" formControlName="unit" placeholder="Unit" />
                    </div>
                    <input
                      type="text"
                      class="input w-full"
                      formControlName="preparation"
                      placeholder="Preparation (optional)"
                    />
                  </div>
                </div>
              }
            </div>
          </div>

          <div>
            <h3 class="mb-2 text-sm font-semibold text-stone-900">Estimated nutrition</h3>
            <div class="grid grid-cols-2 gap-2" formGroupName="nutrition">
              <div>
                <label class="mb-1 block text-xs text-stone-600">Estimated calories</label>
                <input type="number" min="0" class="input w-full" formControlName="calories" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-stone-600">Approx. protein (g)</label>
                <input type="number" min="0" class="input w-full" formControlName="protein_g" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-stone-600">Approx. carbs (g)</label>
                <input type="number" min="0" class="input w-full" formControlName="carbohydrates_g" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-stone-600">Approx. fat (g)</label>
                <input type="number" min="0" class="input w-full" formControlName="fat_g" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-stone-600">Approx. fiber (g)</label>
                <input type="number" min="0" class="input w-full" formControlName="fiber_g" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-stone-600">Approx. sugar (g)</label>
                <input type="number" min="0" class="input w-full" formControlName="sugar_g" />
              </div>
            </div>
          </div>

          @if (draft().assumptions.length > 0) {
            <div class="rounded-lg bg-stone-50 p-3">
              <h3 class="text-sm font-semibold text-stone-900">Assumptions</h3>
              <ul class="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-600">
                @for (assumption of draft().assumptions; track assumption) {
                  <li>{{ assumption }}</li>
                }
              </ul>
            </div>
          }

          @if (draft().warnings.length > 0) {
            <div class="rounded-lg bg-amber-50 p-3">
              <h3 class="text-sm font-semibold text-amber-900">Warnings</h3>
              <ul class="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-800">
                @for (warning of draft().warnings; track warning) {
                  <li>{{ warning }}</li>
                }
              </ul>
            </div>
          }

          @if (draft().clarificationQuestions.length > 0) {
            <div class="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
              <h3 class="text-sm font-semibold text-brand-900">Review hints</h3>
              <ul class="mt-1 space-y-2 text-sm text-brand-800">
                @for (question of draft().clarificationQuestions; track question.id) {
                  <li>
                    <span class="font-medium">{{ question.question }}</span>
                    @if (question.options?.length) {
                      <span class="block text-xs text-brand-700">
                        Options: {{ question.options!.join(', ') }}
                      </span>
                    }
                  </li>
                }
              </ul>
            </div>
          }

          <div>
            <label for="draft-notes" class="mb-1 block text-sm font-medium text-stone-700">
              Notes (optional)
            </label>
            <textarea id="draft-notes" rows="2" class="input w-full" formControlName="notes"></textarea>
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
            {{ saving() ? 'Saving...' : 'Add to meal plan' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MealPhotoDraftFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly foodLogService = inject(FoodLogService);
  private readonly photoService = inject(FoodLogPhotoService);
  private readonly analysisService = inject(MealPhotoAnalysisService);

  readonly draft = input.required<MealPhotoDraft>();
  readonly file = input.required<File>();
  readonly previewUrl = input.required<string>();
  readonly analysisId = input.required<string>();
  readonly context = input<PhotoCaptureContext>({});

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly mealTypes = MEAL_TYPES;
  readonly mealTypeLabels = MEAL_TYPE_LABELS;
  readonly statusOptions = STATUS_OPTIONS;
  readonly weekDates = getUpcomingDates(7);
  readonly today = toISODate(new Date());

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly selectedStatus = signal<DisplayStatus>('planned');

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    date: [this.today, Validators.required],
    mealType: ['lunch' as MealType, Validators.required],
    eatenAt: [''],
    notes: [''],
    items: this.fb.array([] as ReturnType<typeof this.createItemGroup>[]),
    nutrition: this.fb.group({
      calories: this.fb.control<number | null>(null),
      protein_g: this.fb.control<number | null>(null),
      carbohydrates_g: this.fb.control<number | null>(null),
      fat_g: this.fb.control<number | null>(null),
      fiber_g: this.fb.control<number | null>(null),
      sugar_g: this.fb.control<number | null>(null),
    }),
  });

  get items(): FormArray {
    return this.form.controls.items;
  }

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
    this.initializeForm();
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

  shouldHighlightItem(index: number): boolean {
    const confidence = this.items.at(index)?.get('confidence')?.value as number | null;
    return shouldHighlightField(confidence);
  }

  confidenceLabel(index: number): string {
    const confidence = this.items.at(index)?.get('confidence')?.value as number | null;
    return getConfidenceLabel(getConfidenceLevel(confidence));
  }

  addItem(): void {
    this.items.push(
      this.createItemGroup({
        id: crypto.randomUUID(),
        name: '',
        quantity: null,
        unit: null,
        preparation: null,
        confidence: 1,
      })
    );
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) {
      return;
    }
    this.items.removeAt(index);
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.uploadError.set(null);

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

    const formValue = this.buildFormValue();
    const input = formValueToPhotoFoodLogInput({
      formValue,
      imageUrl,
      analysisId: this.analysisId(),
    });

    const { error } = await this.foodLogService.createPhotoFoodLog(input);
    if (error) {
      this.saving.set(false);
      this.saveError.set(error);
      return;
    }

    await this.analysisService.markConfirmed(
      this.analysisId(),
      buildConfirmedPayload(formValue, imageUrl)
    );

    this.saving.set(false);
    this.saved.emit();
  }

  private initializeForm(): void {
    const ctx = this.context();
    const initial = draftToFormValue(this.draft(), {
      date: ctx.defaultDate ?? this.today,
      mealType: ctx.defaultMealType ?? this.form.controls.mealType.value,
      status: 'prepared',
    });

    this.form.patchValue({
      title: initial.title,
      date: initial.date,
      mealType: initial.mealType,
      notes: '',
      nutrition: initial.nutrition,
    });

    this.items.clear();
    for (const item of initial.items) {
      this.items.push(this.createItemGroup(item));
    }
    if (this.items.length === 0) {
      this.addItem();
    }

    this.applyStatusDefaults();
  }

  private createItemGroup(item: {
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    preparation: string | null;
    confidence: number;
  }) {
    return this.fb.group({
      id: [item.id],
      name: [item.name, Validators.required],
      quantity: [item.quantity],
      unit: [item.unit ?? ''],
      preparation: [item.preparation ?? ''],
      confidence: [item.confidence],
    });
  }

  private buildFormValue(): MealPhotoDraftFormValue {
    const raw = this.form.getRawValue();
    const dbStatus = this.resolveDbStatus();

    return {
      title: raw.title,
      date: raw.date,
      mealType: raw.mealType,
      status: dbStatus,
      notes: raw.notes,
      items: raw.items.map((item) => ({
        id: String(item.id ?? crypto.randomUUID()),
        name: String(item.name ?? '').trim(),
        quantity: item.quantity === null || item.quantity === undefined ? null : Number(item.quantity),
        unit: item.unit || null,
        preparation: item.preparation || null,
        confidence: Number(item.confidence ?? 0),
      })),
      nutrition: {
        calories: this.toNullableNumber(raw.nutrition.calories),
        protein_g: this.toNullableNumber(raw.nutrition.protein_g),
        carbohydrates_g: this.toNullableNumber(raw.nutrition.carbohydrates_g),
        fat_g: this.toNullableNumber(raw.nutrition.fat_g),
        fiber_g: this.toNullableNumber(raw.nutrition.fiber_g),
        sugar_g: this.toNullableNumber(raw.nutrition.sugar_g),
      },
    };
  }

  private toNullableNumber(value: number | null | undefined): number | null {
    if (value === null || value === undefined || value === ('' as unknown)) {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
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

  private resolveDbStatus(): 'planned' | 'prepared' | 'eaten' {
    if (this.isFutureDate()) {
      return 'planned';
    }
    const match = STATUS_OPTIONS.find((option) => option.id === this.selectedStatus());
    const status = match?.dbStatus;
    if (status === 'prepared' || status === 'eaten') {
      return status;
    }
    return 'planned';
  }
}
