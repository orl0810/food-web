import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType } from '../../../../core/models/meal-plan.model';
import { PhotoCaptureContext } from '../../../../core/models/photo-food-capture.model';
import { FoodLogPhotoService } from '../../../../core/services/food-log-photo.service';
import { FoodLogService } from '../../../../core/services/food-log.service';
import { getDefaultMealTypeForNow } from '../../../../shared/utils/food-log.utils';
import { toISODate } from '../../../../shared/utils/meal-plan.utils';

@Component({
  selector: 'app-photo-food-log-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 z-overlay flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-food-log-title"
      (click)="cancelled.emit()"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="border-b border-stone-100 p-4">
          <h2 id="photo-food-log-title" class="text-base font-semibold text-stone-900">Log as eaten</h2>
          <p class="mt-0.5 text-sm text-stone-600">Quickly record what you ate.</p>
        </div>

        <form class="flex-1 space-y-4 overflow-y-auto p-4" [formGroup]="form">
          @if (uploadError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ uploadError() }}</p>
          }
          @if (saveError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ saveError() }}</p>
          }

          <div>
            <label for="food-photo" class="mb-1 block text-sm font-medium text-stone-700">Food photo</label>
            <input
              id="food-photo"
              type="file"
              accept="image/*"
              capture="environment"
              class="input w-full"
              (change)="onPhotoSelected($event)"
            />
            @if (previewUrl()) {
              <img
                [src]="previewUrl()!"
                alt="Selected food photo preview"
                class="mt-3 h-40 w-full rounded-lg object-cover"
              />
            }
          </div>

          <div>
            <label for="photo-food-name" class="mb-1 block text-sm font-medium text-stone-700">Food name</label>
            <input id="photo-food-name" type="text" class="input w-full" formControlName="name" placeholder="Pasta salad" />
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
            <label for="photo-food-date" class="mb-1 block text-sm font-medium text-stone-700">Date</label>
            <input id="photo-food-date" type="date" class="input w-full" formControlName="date" [max]="today" />
          </div>

          <div>
            <label for="photo-food-notes" class="mb-1 block text-sm font-medium text-stone-700">Notes (optional)</label>
            <textarea id="photo-food-notes" rows="2" class="input w-full" formControlName="notes"></textarea>
          </div>
        </form>

        <div class="flex gap-3 border-t border-stone-100 p-4">
          <button type="button" class="btn-secondary flex-1" (click)="cancelled.emit()">Cancel</button>
          <button
            type="button"
            class="btn-primary flex-1"
            [disabled]="form.invalid || !selectedFile() || saving()"
            (click)="save()"
          >
            {{ saving() ? 'Saving...' : 'Save food log' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PhotoFoodLogDialogComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly foodLogService = inject(FoodLogService);
  private readonly photoService = inject(FoodLogPhotoService);

  readonly initialFile = input<File | null>(null);
  readonly initialPreviewUrl = input<string | null>(null);
  readonly suggestedName = input<string | null>(null);
  readonly context = input<PhotoCaptureContext>({});

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly mealTypes = MEAL_TYPES;
  readonly mealTypeLabels = MEAL_TYPE_LABELS;
  readonly today = toISODate(new Date());
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly saving = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  private ownsPreviewUrl = false;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    mealType: [getDefaultMealTypeForNow() as MealType, Validators.required],
    date: [this.today, Validators.required],
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

    const file = this.initialFile();
    const preview = this.initialPreviewUrl();
    if (file) {
      this.selectedFile.set(file);
    }
    if (preview) {
      this.previewUrl.set(preview);
      this.ownsPreviewUrl = false;
    }
  }

  ngOnDestroy(): void {
    if (this.ownsPreviewUrl) {
      const preview = this.previewUrl();
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    }
    document.body.classList.remove('overflow-hidden');
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.uploadError.set(null);

    if (this.ownsPreviewUrl) {
      const previousPreview = this.previewUrl();
      if (previousPreview) {
        URL.revokeObjectURL(previousPreview);
      }
    }

    if (!file) {
      this.selectedFile.set(null);
      this.previewUrl.set(null);
      this.ownsPreviewUrl = false;
      return;
    }

    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.ownsPreviewUrl = true;
  }

  async save(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.form.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.uploadError.set(null);
    this.saveError.set(null);

    let imageUrl: string;
    try {
      imageUrl = await this.photoService.uploadFoodPhoto(file);
    } catch (err) {
      this.saving.set(false);
      this.uploadError.set(
        err instanceof Error ? err.message : 'We could not upload the photo. Please try again.'
      );
      return;
    }

    const value = this.form.getRawValue();
    const { error } = await this.foodLogService.createPhotoFoodLog({
      name: value.name,
      date: value.date,
      mealType: value.mealType,
      notes: value.notes || null,
      imageUrl,
      status: 'eaten',
    });

    this.saving.set(false);

    if (error) {
      this.saveError.set("We couldn't save this food log. Please try again.");
      return;
    }

    this.saved.emit();
  }
}
