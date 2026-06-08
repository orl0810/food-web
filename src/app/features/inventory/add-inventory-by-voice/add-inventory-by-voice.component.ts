import { Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  STORAGE_LOCATION_LABELS,
  STORAGE_LOCATIONS,
} from '../../../core/models/food-item.model';
import { VoiceInventoryDraftItem } from '../../../core/models/voice-inventory.model';
import { InventoryVoiceParserService } from '../../../core/services/inventory-voice-parser.service';
import { VoiceInputService } from '../../../core/services/voice-input.service';

type VoiceStep = 'transcript' | 'review';

@Component({
  selector: 'app-add-inventory-by-voice',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="card space-y-5 p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-stone-900">Add inventory by voice</h2>
          <p class="mt-1 text-sm text-stone-600">
            Speak or type the food you want to add, then review everything before saving.
          </p>
        </div>
        <button
          type="button"
          class="text-sm text-stone-500 hover:text-stone-700"
          (click)="cancel()"
        >
          Cancel
        </button>
      </div>

      @if (!voiceInput.isSupported()) {
        <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Voice input is not supported in this browser. Please add items manually.
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

      @if (saveError()) {
        <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ saveError() }}
        </p>
      }

      @if (step() === 'transcript') {
        <div class="space-y-4">
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
            <label for="voice-transcript" class="mb-1 block text-sm font-medium text-stone-700">
              Transcript
            </label>
            <textarea
              id="voice-transcript"
              rows="5"
              class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              [ngModel]="voiceInput.transcript()"
              (ngModelChange)="updateTranscript($event)"
              placeholder="Start speaking and describe the food you want to add."
            ></textarea>
            <p class="mt-1 text-xs text-stone-500">
              You can edit the transcript before extracting items.
            </p>
          </div>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              (click)="cancel()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="!voiceInput.transcript().trim()"
              (click)="extractItems()"
            >
              Review items
            </button>
          </div>
        </div>
      } @else {
        <div class="space-y-4">
          @if (warnings().length > 0) {
            <div class="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              @for (warning of warnings(); track warning) {
                <p>{{ warning }}</p>
              }
            </div>
          }

          @if (draftItems().length === 0) {
            <div class="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-8 text-center">
              <h3 class="text-base font-medium text-stone-900">No draft items yet</h3>
              <p class="mx-auto mt-2 max-w-md text-sm text-stone-600">
                I could not detect items automatically. Add a draft item manually and save when ready.
              </p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (draft of draftItems(); track $index; let index = $index) {
                <article class="rounded-xl border border-stone-200 bg-white p-4">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <h3 class="text-sm font-semibold text-stone-900">Draft item {{ index + 1 }}</h3>
                    <button
                      type="button"
                      class="text-sm font-medium text-red-600 hover:text-red-700"
                      (click)="removeDraft(index)"
                    >
                      Remove
                    </button>
                  </div>

                  <div class="grid gap-4 sm:grid-cols-2">
                    <div class="sm:col-span-2">
                      <label class="mb-1 block text-sm font-medium text-stone-700">
                        Name *
                        <input
                          type="text"
                          class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                          [(ngModel)]="draft.name"
                        />
                      </label>
                    </div>

                    <label class="block text-sm font-medium text-stone-700">
                      Category
                      <input
                        type="text"
                        class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        [(ngModel)]="draft.category"
                        placeholder="Dairy, Produce..."
                      />
                    </label>

                    <label class="block text-sm font-medium text-stone-700">
                      Location *
                      <select
                        class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        [(ngModel)]="draft.location"
                      >
                        @for (location of locations; track location) {
                          <option [value]="location">{{ locationLabels[location] }}</option>
                        }
                      </select>
                    </label>

                    <label class="block text-sm font-medium text-stone-700">
                      Quantity *
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        [(ngModel)]="draft.quantity"
                      />
                    </label>

                    <label class="block text-sm font-medium text-stone-700">
                      Unit
                      <input
                        type="text"
                        class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        [(ngModel)]="draft.unit"
                        placeholder="kg, cans, pcs"
                      />
                    </label>

                    <label class="block text-sm font-medium text-stone-700 sm:col-span-2">
                      Expiration date
                      <input
                        type="date"
                        class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        [(ngModel)]="draft.expiration_date"
                      />
                    </label>
                  </div>
                </article>
              }
            </div>
          }

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              (click)="addDraft()"
            >
              Add another item
            </button>

            <div class="flex justify-end gap-3">
              <button
                type="button"
                class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                (click)="step.set('transcript')"
              >
                Edit transcript
              </button>
              <button
                type="button"
                class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                [disabled]="submitting() || !hasValidDrafts()"
                (click)="confirmSave()"
              >
                {{ submitting() ? 'Saving...' : 'Save to inventory' }}
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class AddInventoryByVoiceComponent implements OnDestroy {
  readonly voiceInput = inject(VoiceInputService);
  private readonly parser = inject(InventoryVoiceParserService);

  readonly submitting = input(false);
  readonly saveError = input<string | null>(null);
  readonly saved = output<VoiceInventoryDraftItem[]>();
  readonly cancelled = output<void>();

  readonly locations = STORAGE_LOCATIONS;
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  readonly step = signal<VoiceStep>('transcript');
  readonly draftItems = signal<VoiceInventoryDraftItem[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly localError = signal<string | null>(null);

  ngOnDestroy(): void {
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

  extractItems(): void {
    const transcript = this.voiceInput.transcript().trim();
    if (!transcript) {
      this.localError.set('Add a transcript before reviewing items.');
      return;
    }

    const result = this.parser.parseTranscriptToInventoryItems(transcript);
    this.draftItems.set(result.items);
    this.warnings.set(result.warnings ?? []);
    this.localError.set(null);
    this.step.set('review');
  }

  addDraft(): void {
    this.draftItems.update((items) => [
      ...items,
      {
        name: '',
        category: null,
        quantity: 1,
        unit: null,
        expiration_date: null,
        location: 'fridge',
      },
    ]);
  }

  removeDraft(index: number): void {
    this.draftItems.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  hasValidDrafts(): boolean {
    return this.getCleanDrafts().length > 0;
  }

  confirmSave(): void {
    const drafts = this.getCleanDrafts();
    if (drafts.length === 0) {
      this.localError.set('Add at least one item name before saving.');
      return;
    }

    this.localError.set(null);
    this.saved.emit(drafts);
  }

  cancel(): void {
    this.voiceInput.clear();
    this.cancelled.emit();
  }

  private getCleanDrafts(): VoiceInventoryDraftItem[] {
    return this.draftItems()
      .map((item) => ({
        name: item.name.trim(),
        category: item.category?.trim() || null,
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        unit: item.unit?.trim() || null,
        expiration_date: item.expiration_date || null,
        location: item.location,
      }))
      .filter((item) => item.name.length > 0);
  }
}
