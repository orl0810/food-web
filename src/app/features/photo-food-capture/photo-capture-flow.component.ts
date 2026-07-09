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
import { FoodLogPhotoService } from '../../core/services/food-log-photo.service';
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

@Component({
  selector: 'app-photo-capture-flow',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
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
            @if (step() === 'capture') {
              Add with photo
            } @else {
              What would you like to do with this?
            }
          </h2>
          <p class="mt-0.5 text-sm text-stone-600">
            @if (step() === 'capture') {
              Take or upload a photo of your food.
            } @else {
              Choose how to save this photo.
            }
          </p>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto p-4">
          @if (validationError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {{ validationError() }}
            </p>
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
                accept="image/*"
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
          } @else {
            @if (previewUrl()) {
              <img
                [src]="previewUrl()!"
                alt="Selected food photo preview"
                class="h-32 w-full rounded-lg object-cover"
              />
            }

            <div class="space-y-2">
              @for (option of destinationOptions; track option.id) {
                <button
                  type="button"
                  class="flex w-full items-start gap-3 rounded-xl border border-stone-200 p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  (click)="chooseDestination(option.id)"
                >
                  <span
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
                    aria-hidden="true"
                  >
                    @switch (option.id) {
                      @case ('recipe') {
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      }
                      @case ('mealPlan') {
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                      }
                      @case ('foodLog') {
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                      }
                    }
                  </span>
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
          <button
            type="button"
            class="btn-secondary flex-1"
            [class.flex-1]="step() === 'capture'"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
          @if (step() === 'capture') {
            <button
              type="button"
              class="btn-primary flex-1"
              [disabled]="!selectedFile()"
              (click)="continueToDestination()"
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

  readonly context = input<PhotoCaptureContext>({});
  readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly destinationChosen = output<PhotoCaptureSelection>();
  readonly cancelled = output<void>();

  readonly destinationOptions = DESTINATION_OPTIONS;
  readonly step = signal<'capture' | 'destination'>('capture');
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly analysis = signal<FoodPhotoAnalysisResult | null>(null);

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy(): void {
    this.revokePreview();
    document.body.classList.remove('overflow-hidden');
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.validationError.set(null);
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
      input.value = '';
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
    const input = this.fileInputRef()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  continueToDestination(): void {
    if (!this.selectedFile()) {
      return;
    }
    this.step.set('destination');
    void this.loadAnalysis();
  }

  backToCapture(): void {
    this.step.set('capture');
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
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic']);
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
