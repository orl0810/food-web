import { Component, OnDestroy, OnInit, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType } from '../../../../core/models/meal-plan.model';
import { FoodLogService } from '../../../../core/services/food-log.service';
import { FoodLogVoiceParserService } from '../../../../core/services/food-log-voice-parser.service';
import { VoiceInputService } from '../../../../core/services/voice-input.service';
import { getDefaultMealTypeForNow } from '../../../../shared/utils/food-log.utils';
import { toISODate } from '../../../../shared/utils/meal-plan.utils';

type VoiceStep = 'capture' | 'confirm';

@Component({
  selector: 'app-voice-food-log-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 z-overlay flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-food-log-title"
      (click)="cancelled.emit()"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="border-b border-stone-100 p-4">
          <h2 id="voice-food-log-title" class="text-base font-semibold text-stone-900">Log with voice</h2>
          <p class="mt-0.5 text-sm text-stone-600">Speak what you ate, then review before saving.</p>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto p-4">
          @if (!voiceInput.isSupported()) {
            <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Voice input is not available on this browser. You can add it manually.
            </p>
            <button type="button" class="text-sm font-medium text-brand-700 hover:text-brand-800" (click)="switchToManual.emit()">
              Log food manually instead
            </button>
          } @else {
            @if (voiceInput.error()) {
              <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ voiceInput.error() }}</p>
            }

            @if (error()) {
              <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
            }

            @if (step() === 'capture') {
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="btn-primary"
                  [disabled]="voiceInput.isListening()"
                  (click)="voiceInput.startListening()"
                >
                  Start recording
                </button>
                <button
                  type="button"
                  class="btn-secondary"
                  [disabled]="!voiceInput.isListening()"
                  (click)="voiceInput.stopListening()"
                >
                  Stop
                </button>
                <span class="text-sm text-stone-500">
                  {{ voiceInput.isListening() ? 'Recording...' : 'Not recording' }}
                </span>
              </div>

              <div>
                <label for="voice-transcript" class="mb-1 block text-sm font-medium text-stone-700">Transcript</label>
                <textarea
                  id="voice-transcript"
                  rows="4"
                  class="input w-full"
                  [value]="voiceInput.transcript()"
                  (input)="onTranscriptInput($event)"
                  placeholder="I had chicken sandwich and orange juice for lunch."
                ></textarea>
              </div>

              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn-primary"
                  [disabled]="!voiceInput.transcript().trim()"
                  (click)="goToConfirm()"
                >
                  Review entry
                </button>
              </div>
            } @else {
              <form class="space-y-4" [formGroup]="form">
                <div>
                  <label for="voice-food-name" class="mb-1 block text-sm font-medium text-stone-700">Food name</label>
                  <input id="voice-food-name" type="text" class="input w-full" formControlName="name" />
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
                  <label for="voice-food-date" class="mb-1 block text-sm font-medium text-stone-700">Date</label>
                  <input id="voice-food-date" type="date" class="input w-full" formControlName="date" [max]="today" />
                </div>
              </form>
            }
          }
        </div>

        <div class="flex gap-3 border-t border-stone-100 p-4">
          <button type="button" class="btn-secondary flex-1" (click)="cancel()">Cancel</button>
          @if (step() === 'confirm') {
            <button type="button" class="btn-secondary flex-1" (click)="step.set('capture')">Back</button>
            <button
              type="button"
              class="btn-primary flex-1"
              [disabled]="form.invalid || saving()"
              (click)="save()"
            >
              {{ saving() ? 'Saving...' : 'Confirm & save' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class VoiceFoodLogDialogComponent implements OnInit, OnDestroy {
  readonly voiceInput = inject(VoiceInputService);
  private readonly foodLogService = inject(FoodLogService);
  private readonly parser = inject(FoodLogVoiceParserService);
  private readonly fb = inject(FormBuilder);

  readonly saved = output<void>();
  readonly cancelled = output<void>();
  readonly switchToManual = output<void>();

  readonly mealTypes = MEAL_TYPES;
  readonly mealTypeLabels = MEAL_TYPE_LABELS;
  readonly today = toISODate(new Date());
  readonly step = signal<VoiceStep>('capture');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    mealType: [getDefaultMealTypeForNow() as MealType, Validators.required],
    date: [this.today, Validators.required],
  });

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy(): void {
    this.voiceInput.clear();
    document.body.classList.remove('overflow-hidden');
  }

  onTranscriptInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.voiceInput.setTranscript(value);
  }

  goToConfirm(): void {
    const parsed = this.parser.parseFoodLogFromTranscript(this.voiceInput.transcript());
    this.form.patchValue({
      name: parsed.name,
      mealType: parsed.mealType ?? getDefaultMealTypeForNow(),
    });
    this.step.set('confirm');
  }

  cancel(): void {
    this.voiceInput.clear();
    this.cancelled.emit();
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();
    const { error } = await this.foodLogService.createVoiceFoodLog({
      name: value.name,
      date: value.date,
      mealType: value.mealType,
      transcript: this.voiceInput.transcript(),
      markAsConsumed: true,
    });

    this.saving.set(false);

    if (error) {
      this.error.set("We couldn't save this food log. Please try again.");
      return;
    }

    this.voiceInput.clear();
    this.saved.emit();
  }
}
