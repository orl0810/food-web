import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MealPhotoAnalysisCompleteEvent } from '../../core/models/meal-photo-analysis.model';
import { FoodLogPhotoService } from '../../core/services/food-log-photo.service';
import { MealPhotoAnalysisService } from '../../core/services/meal-photo-analysis.service';
import {
  PhotoCaptureContext,
  PhotoCaptureDestination,
  PhotoCaptureSelection,
  FoodPhotoAnalysisResult,
} from '../../core/models/photo-food-capture.model';

const DESTINATION_OPTIONS: {
  id: PhotoCaptureDestination;
  title: string;
  description: string;
}[] = [
  {
    id: 'recipe',
    title: 'Create recipe',
    description: 'Save this as a reusable recipe.',
  },
  {
    id: 'mealPlan',
    title: 'Add to meal plan',
    description: 'Plan this meal for today or another day.',
  },
  {
    id: 'foodLog',
    title: 'Log as eaten',
    description: 'Quickly record what you ate.',
  },
];

type FlowStep =
  | 'capture'
  | 'destination'
  | 'uploading'
  | 'analyzing'
  | 'failed';

@Component({
  selector: 'app-photo-capture-flow',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-overlay flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-capture-title"
      (click)="cancelled.emit()"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="border-b border-stone-100 p-4">
          <h2 id="photo-capture-title" class="text-base font-semibold text-stone-900">
            @switch (step()) {
              @case ('capture') { Add with photo }
              @case ('uploading') { Uploading photo... }
              @case ('analyzing') { Analyzing meal... }
              @case ('failed') { Analysis failed }
              @default { What would you like to do with this? }
            }
          </h2>
          <p class="mt-0.5 text-sm text-stone-600">
            @switch (step()) {
              @case ('capture') {
                Take or upload a photo of your food.
              }
              @case ('uploading') {
                Optimizing and uploading your photo securely.
              }
              @case ('analyzing') {
                Identifying foods and estimating nutrition. This may take a moment.
              }
              @case ('failed') {
                We could not analyze this photo. You can retry or continue manually.
              }
              @default {
                Choose how to save this photo.
              }
            }
          </p>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto p-4">
          @if (validationError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {{ validationError() }}
            </p>
          }

          @if (analysisError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {{ analysisError() }}
            </p>
          }

          @if (step() === 'uploading' || step() === 'analyzing') {
            <div class="flex flex-col items-center justify-center gap-3 py-10" aria-live="polite">
              <div class="h-10 w-10 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"></div>
              <p class="text-sm text-stone-600">
                {{ step() === 'uploading' ? 'Uploading...' : 'Analyzing your meal...' }}
              </p>
            </div>
          }

          @if (step() === 'capture') {
            <div>
              <label for="photo-capture-input" class="mb-1 block text-sm font-medium text-stone-700">
                Food photo
              </label>
              <input
                #fileInput
                id="photo-capture-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                class="input w-full"
                (change)="onPhotoSelected($event)"
              />
              @if (previewUrl()) {
                <div class="relative mt-3">
                  <img
                    [src]="previewUrl()!"
                    alt="Selected food photo preview"
                    class="h-48 w-full rounded-lg object-cover"
                    (error)="onPreviewError()"
                  />
                  <button
                    type="button"
                    class="absolute top-2 right-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-stone-700 shadow-sm hover:bg-white"
                    (click)="clearPhoto()"
                  >
                    Remove
                  </button>
                </div>
              }
            </div>
          }

          @if (step() === 'destination' || step() === 'failed') {
            @if (previewUrl()) {
              <img
                [src]="previewUrl()!"
                alt="Selected food photo preview"
                class="h-32 w-full rounded-lg object-cover"
              />
            }
          }

          @if (step() === 'destination') {
            <div class="space-y-2">
              @for (option of destinationOptions; track option.id) {
                <button
                  type="button"
                  class="flex w-full items-start gap-3 rounded-xl border border-stone-200 p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  (click)="chooseDestination(option.id)"
                >
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-semibold text-stone-900">{{ option.title }}</span>
                    <span class="mt-0.5 block text-sm text-stone-600">{{ option.description }}</span>
                  </span>
                </button>
              }
            </div>
          }
        </div>

        <div class="flex gap-3 border-t border-stone-100 p-4">
          @if (step() === 'destination') {
            <button type="button" class="btn-secondary flex-1" (click)="backToCapture()">Back</button>
          }
          @if (step() === 'failed') {
            <button type="button" class="btn-secondary flex-1" (click)="retryAnalysis()">Retry analysis</button>
            <button type="button" class="btn-secondary flex-1" (click)="continueManually()">Continue manually</button>
          }
          <button
            type="button"
            class="btn-secondary flex-1"
            [disabled]="step() === 'uploading' || step() === 'analyzing'"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
          @if (step() === 'capture') {
            <button
              type="button"
              class="btn-primary flex-1"
              [disabled]="!selectedFile()"
              (click)="onContinue()"
            >
              Continue
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class PhotoCaptureFlowComponent implements OnInit, OnDestroy {
  private readonly photoService = inject(FoodLogPhotoService);
  private readonly analysisService = inject(MealPhotoAnalysisService);

  readonly context = input<PhotoCaptureContext>({});
  readonly aiMealPlanMode = input(false);
  readonly presetDestination = input<PhotoCaptureDestination | null>(null);
  readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly destinationChosen = output<PhotoCaptureSelection>();
  readonly draftReady = output<MealPhotoAnalysisCompleteEvent>();
  readonly manualFallback = output<PhotoCaptureSelection>();
  readonly cancelled = output<void>();

  readonly destinationOptions = DESTINATION_OPTIONS;
  readonly step = signal<FlowStep>('capture');
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly analysisError = signal<string | null>(null);
  readonly analysis = signal<FoodPhotoAnalysisResult | null>(null);
  readonly currentAnalysisId = signal<string | null>(null);
  readonly optimizedFile = signal<File | null>(null);

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy(): void {
    this.revokePreview();
    document.body.classList.remove('overflow-hidden');
  }

  onPhotoSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0] ?? null;
    this.validationError.set(null);
    this.analysisError.set(null);
    this.revokePreview();

    if (!file) {
      this.selectedFile.set(null);
      this.previewUrl.set(null);
      return;
    }

    try {
      this.validateFile(file);
      this.selectedFile.set(file);
      this.previewUrl.set(URL.createObjectURL(file));
    } catch (err) {
      this.selectedFile.set(null);
      this.previewUrl.set(null);
      this.validationError.set(err instanceof Error ? err.message : 'Invalid image.');
      inputEl.value = '';
    }
  }

  onPreviewError(): void {
    this.validationError.set('Could not preview this image. You can still try to continue.');
  }

  clearPhoto(): void {
    this.revokePreview();
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.validationError.set(null);
    this.analysisError.set(null);
    this.currentAnalysisId.set(null);
    this.optimizedFile.set(null);
    const input = this.fileInputRef()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  async onContinue(): Promise<void> {
    if (!this.selectedFile()) {
      return;
    }

    if (this.aiMealPlanMode()) {
      if (this.analysisService.isAvailable()) {
        await this.runAiPipeline();
        return;
      }
      this.continueManually();
      return;
    }

    const preset = this.presetDestination();
    if (preset) {
      await this.loadAnalysis();
      this.chooseDestination(preset);
      return;
    }

    this.step.set('destination');
    void this.loadAnalysis();
  }

  backToCapture(): void {
    this.step.set('capture');
    this.analysisError.set(null);
  }

  chooseDestination(destination: PhotoCaptureDestination): void {
    const file = this.selectedFile();
    const previewUrl = this.previewUrl();
    if (!file || !previewUrl) {
      return;
    }

    this.destinationChosen.emit({
      destination,
      file,
      previewUrl,
      analysis: this.analysis(),
    });
  }

  continueManually(): void {
    const file = this.selectedFile();
    const previewUrl = this.previewUrl();
    if (!file || !previewUrl) {
      return;
    }

    this.manualFallback.emit({
      destination: 'mealPlan',
      file,
      previewUrl,
      analysis: this.analysis(),
    });
  }

  async retryAnalysis(): Promise<void> {
    if (!this.currentAnalysisId()) {
      await this.runAiPipeline(true);
      return;
    }

    this.step.set('analyzing');
    this.analysisError.set(null);

    const result = await this.analysisService.analyze(this.currentAnalysisId()!, {
      mealType: this.context().defaultMealType,
    });

    if (result.draft && result.error === null) {
      this.emitDraftReady(result.draft);
      return;
    }

    this.step.set('failed');
    this.analysisError.set(result.error ?? 'Could not analyze this photo.');
  }

  private async runAiPipeline(forceNewUpload = false): Promise<void> {
    const file = this.selectedFile();
    const previewUrl = this.previewUrl();
    if (!file || !previewUrl) {
      return;
    }

    try {
      this.step.set('uploading');
      this.analysisError.set(null);

      let analysisId = this.currentAnalysisId();
      let optimized = this.optimizedFile();

      if (forceNewUpload || !analysisId) {
        const created = await this.analysisService.createAnalysis(file);
        analysisId = created.analysisId;
        optimized = created.optimizedFile;
        this.currentAnalysisId.set(analysisId);
        this.optimizedFile.set(optimized);
      }

      this.step.set('analyzing');
      const result = await this.analysisService.analyze(analysisId!, {
        mealType: this.context().defaultMealType,
      });

      if (result.draft && result.error === null) {
        this.emitDraftReady(result.draft);
        return;
      }

      this.step.set('failed');
      this.analysisError.set(result.error ?? 'Could not analyze this photo.');
    } catch (err) {
      this.step.set('failed');
      this.analysisError.set(
        err instanceof Error ? err.message : 'Could not analyze this photo.'
      );
    }
  }

  private emitDraftReady(draft: MealPhotoAnalysisCompleteEvent['draft']): void {
    const file = this.optimizedFile() ?? this.selectedFile();
    const previewUrl = this.previewUrl();
    const analysisId = this.currentAnalysisId();
    if (!file || !previewUrl || !analysisId) {
      return;
    }

    this.draftReady.emit({
      file,
      previewUrl,
      draft,
      analysisId,
    });
  }

  private async loadAnalysis(): Promise<void> {
    const file = this.selectedFile();
    if (!file) {
      return;
    }
    try {
      const result = await this.photoService.analyzeFoodPhoto(file);
      this.analysis.set(result);
    } catch {
      this.analysis.set(null);
    }
  }

  private validateFile(file: File): void {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);
    if (!allowed.has(file.type)) {
      throw new Error('This image format is not supported.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('The image is too large. Please choose a smaller one.');
    }
  }

  private revokePreview(): void {
    const preview = this.previewUrl();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.previewUrl.set(null);
  }
}
