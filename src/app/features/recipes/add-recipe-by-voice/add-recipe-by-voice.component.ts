import { Component, OnDestroy, OnInit, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecipeVoiceDraft } from '../../../core/models/voice-recipe.model';
import { RecipeVoiceParserService } from '../../../core/services/recipe-voice-parser.service';
import { VoiceInputService } from '../../../core/services/voice-input.service';

@Component({
  selector: 'app-add-recipe-by-voice',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div
      class="fixed inset-0 z-dialog-elevated flex items-center justify-center bg-stone-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-recipe-title"
      (click)="cancel()"
    >
      <div
        class="card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="shrink-0 border-b border-stone-200 px-5 py-4">
          <h2 id="voice-recipe-title" class="text-lg font-semibold text-stone-900">
            Create recipe with voice
          </h2>
          <p class="mt-1 text-sm text-stone-600">
            Describe your recipe, then review the pre-filled form before saving.
          </p>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          @if (!voiceInput.isSupported()) {
            <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Voice input is not supported in this browser. You can type your recipe below.
            </p>
          }

          @if (voiceInput.error()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ voiceInput.error() }}
            </p>
          }

          @if (localError()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ localError() }}
            </p>
          }

          @if (warnings().length > 0) {
            <div class="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              @for (warning of warnings(); track warning) {
                <p>{{ warning }}</p>
              }
            </div>
          }

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="btn-primary"
              [disabled]="!voiceInput.isSupported() || voiceInput.isListening()"
              (click)="startListening()"
            >
              Start speaking
            </button>
            <button
              type="button"
              class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="!voiceInput.isListening()"
              (click)="voiceInput.stopListening()"
            >
              Stop
            </button>
            <span class="text-sm text-stone-500">
              {{ voiceInput.isListening() ? 'Listening...' : 'Not recording' }}
            </span>
          </div>

          <div>
            <label for="recipe-voice-transcript" class="mb-1 block text-sm font-medium text-stone-700">
              Transcript
            </label>
            <textarea
              id="recipe-voice-transcript"
              rows="6"
              class="input"
              [ngModel]="voiceInput.transcript()"
              (ngModelChange)="updateTranscript($event)"
              placeholder="Pasta carbonara. Serves 4. Ingredients: 200 grams spaghetti, 2 eggs, 100 grams bacon. Steps: boil the pasta, then fry the bacon, then mix with eggs."
            ></textarea>
            <p class="mt-1 text-xs text-stone-500">
              Tip: say the title first, then "ingredients", then "steps". You can edit the transcript before continuing.
            </p>
          </div>
        </div>

        <div class="flex shrink-0 justify-end gap-3 border-t border-stone-200 px-5 py-4">
          <button type="button" class="btn-secondary" (click)="cancel()">Cancel</button>
          <button
            type="button"
            class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="!voiceInput.transcript().trim()"
            (click)="continueToForm()"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AddRecipeByVoiceComponent implements OnInit, OnDestroy {
  readonly voiceInput = inject(VoiceInputService);
  private readonly parser = inject(RecipeVoiceParserService);

  readonly continued = output<RecipeVoiceDraft>();
  readonly cancelled = output<void>();

  readonly localError = signal<string | null>(null);
  readonly warnings = signal<string[]>([]);

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
    this.voiceInput.clear();
  }

  startListening(): void {
    this.localError.set(null);
    this.voiceInput.startListening();
  }

  updateTranscript(transcript: string): void {
    this.localError.set(null);
    this.voiceInput.setTranscript(transcript);
  }

  continueToForm(): void {
    const transcript = this.voiceInput.transcript().trim();
    if (!transcript) {
      this.localError.set('Add a transcript before continuing.');
      return;
    }

    const result = this.parser.parseTranscriptToRecipeDraft(transcript);
    this.warnings.set(result.warnings ?? []);
    this.localError.set(null);
    this.continued.emit(result.draft);
  }

  cancel(): void {
    this.voiceInput.clear();
    this.cancelled.emit();
  }
}
