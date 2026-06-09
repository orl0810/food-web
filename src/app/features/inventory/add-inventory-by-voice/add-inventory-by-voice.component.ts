import { Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  STORAGE_LOCATION_LABELS,
  STORAGE_LOCATIONS,
} from '../../../core/models/food-item.model';
import { VoiceInventoryDraftItem } from '../../../core/models/voice-inventory.model';
import { InventoryVoiceParserService } from '../../../core/services/inventory-voice-parser.service';
import { VoiceInputService } from '../../../core/services/voice-input.service';
import { FoodIconBadgeComponent } from '../../../shared/components/food-icon-badge/food-icon-badge.component';
import {
  getExpirationLabel,
  getExpirationShortLabel,
  getExpirationStatus,
} from '../../../shared/utils/expiration.utils';

type VoiceStep = 'transcript' | 'review';

@Component({
  selector: 'app-add-inventory-by-voice',
  standalone: true,
  imports: [FormsModule, FoodIconBadgeComponent],
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
            <section class="card overflow-hidden">
              <div class="divide-y divide-stone-200/60">
                @for (draft of draftItems(); track $index; let index = $index) {
                  <article>
                    <div class="flex flex-wrap items-start gap-x-2.5 gap-y-2 sm:flex-nowrap sm:items-center sm:gap-3">
                      <button
                        type="button"
                        class="flex min-w-0 flex-1 flex-wrap items-start gap-x-2.5 gap-y-2 rounded-lg px-4 py-3 text-left transition-colors hover:bg-stone-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 sm:flex-nowrap sm:items-center sm:gap-3 sm:px-5"
                        [attr.aria-expanded]="isDraftExpanded(index)"
                        [attr.aria-controls]="'draft-form-' + index"
                        (click)="toggleDraftExpanded(index)"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                          stroke="currentColor"
                          class="h-4 w-4 shrink-0 text-stone-400 transition-transform"
                          [class.rotate-90]="isDraftExpanded(index)"
                          aria-hidden="true"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>

                        <app-food-icon-badge
                          [name]="draftDisplayName(draft) || draft.name"
                          [category]="draft.category"
                        />

                        <div class="min-w-0 flex-1 sm:flex sm:items-center sm:gap-5">
                          <div class="flex items-start justify-between gap-2 sm:contents">
                            <p
                              class="truncate text-sm font-semibold sm:w-32 sm:shrink-0 lg:w-40"
                              [class.text-stone-900]="draftDisplayName(draft)"
                              [class.text-stone-400]="!draftDisplayName(draft)"
                              [class.italic]="!draftDisplayName(draft)"
                            >
                              {{ draftDisplayName(draft) || 'Untitled item' }}
                            </p>

                            <span
                              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight sm:hidden"
                              [class.bg-red-50]="draftExpirationStatus(draft) === 'expired'"
                              [class.text-red-700]="draftExpirationStatus(draft) === 'expired'"
                              [class.bg-amber-50]="draftExpirationStatus(draft) === 'soon'"
                              [class.text-amber-700]="draftExpirationStatus(draft) === 'soon'"
                              [class.bg-stone-100]="draftExpirationStatus(draft) === 'none' || draftExpirationStatus(draft) === 'ok'"
                              [class.text-stone-600]="draftExpirationStatus(draft) === 'none' || draftExpirationStatus(draft) === 'ok'"
                            >
                              {{ draftExpirationLabel(draft) }}
                            </span>
                          </div>

                          <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 sm:mt-0 sm:flex-1">
                            <span
                              class="font-medium"
                              [class.text-red-600]="draftExpirationStatus(draft) === 'expired'"
                              [class.text-amber-600]="draftExpirationStatus(draft) === 'soon'"
                              [class.text-stone-600]="draftExpirationStatus(draft) === 'none' || draftExpirationStatus(draft) === 'ok'"
                            >
                              {{ draft.expiration_date ? draftExpirationShortLabel(draft.expiration_date) : 'No date' }}
                            </span>
                            <span class="text-stone-300" aria-hidden="true">·</span>
                            <span>{{ locationLabels[draft.location] }}</span>
                            <span class="text-stone-300" aria-hidden="true">·</span>
                            <span>{{ draft.quantity ?? 1 }} {{ draft.unit || 'units' }}</span>
                            @if (draft.category) {
                              <span class="text-stone-300" aria-hidden="true">·</span>
                              <span>{{ draft.category }}</span>
                            }
                          </p>
                        </div>

                        <span
                          class="hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight sm:inline-flex sm:self-center"
                          [class.bg-red-50]="draftExpirationStatus(draft) === 'expired'"
                          [class.text-red-700]="draftExpirationStatus(draft) === 'expired'"
                          [class.bg-amber-50]="draftExpirationStatus(draft) === 'soon'"
                          [class.text-amber-700]="draftExpirationStatus(draft) === 'soon'"
                          [class.bg-stone-100]="draftExpirationStatus(draft) === 'none' || draftExpirationStatus(draft) === 'ok'"
                          [class.text-stone-600]="draftExpirationStatus(draft) === 'none' || draftExpirationStatus(draft) === 'ok'"
                        >
                          {{ draftExpirationLabel(draft) }}
                        </span>

                        <span class="shrink-0 text-xs font-medium text-brand-600 sm:self-center">
                          {{ isDraftExpanded(index) ? 'Collapse' : 'Tap to edit' }}
                        </span>
                      </button>

                      <div class="flex w-full shrink-0 items-center justify-end gap-1 px-4 pb-3 sm:w-auto sm:self-center sm:px-0 sm:pb-0 sm:pr-5">
                        <button
                          type="button"
                          class="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          (click)="removeDraft(index)"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    @if (isDraftExpanded(index)) {
                      <div
                        [id]="'draft-form-' + index"
                        class="border-t border-stone-200/60 bg-stone-50/40 px-4 py-4 sm:px-5"
                      >
                        <div class="grid gap-4 sm:grid-cols-2">
                          <div class="sm:col-span-2">
                            <label class="mb-1 block text-sm font-medium text-stone-700">
                              Name *
                              <input
                                type="text"
                                class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                                [(ngModel)]="draft.name"
                              />
                            </label>
                          </div>

                          <label class="block text-sm font-medium text-stone-700">
                            Category
                            <input
                              type="text"
                              class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                              [(ngModel)]="draft.category"
                              placeholder="Dairy, Produce..."
                            />
                          </label>

                          <label class="block text-sm font-medium text-stone-700">
                            Location *
                            <select
                              class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
                              class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                              [(ngModel)]="draft.quantity"
                            />
                          </label>

                          <label class="block text-sm font-medium text-stone-700">
                            Unit
                            <input
                              type="text"
                              class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                              [(ngModel)]="draft.unit"
                              placeholder="kg, cans, pcs"
                            />
                          </label>

                          <label class="block text-sm font-medium text-stone-700 sm:col-span-2">
                            Expiration date
                            <input
                              type="date"
                              class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                              [(ngModel)]="draft.expiration_date"
                            />
                          </label>
                        </div>
                      </div>
                    }
                  </article>
                }
              </div>
            </section>
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
  readonly expandedDraftIndices = signal<Set<number>>(new Set());
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
    this.expandedDraftIndices.set(new Set());
    this.warnings.set(result.warnings ?? []);
    this.localError.set(null);
    this.step.set('review');
  }

  addDraft(): void {
    const newIndex = this.draftItems().length;
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
    this.setDraftExpanded(newIndex, true);
  }

  removeDraft(index: number): void {
    this.draftItems.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
    this.expandedDraftIndices.update((expanded) => {
      const next = new Set<number>();
      for (const expandedIndex of expanded) {
        if (expandedIndex < index) {
          next.add(expandedIndex);
        } else if (expandedIndex > index) {
          next.add(expandedIndex - 1);
        }
      }
      return next;
    });
  }

  isDraftExpanded(index: number): boolean {
    return this.expandedDraftIndices().has(index);
  }

  toggleDraftExpanded(index: number): void {
    this.setDraftExpanded(index, !this.isDraftExpanded(index));
  }

  draftDisplayName(draft: VoiceInventoryDraftItem): string {
    return draft.name.trim();
  }

  draftExpirationLabel(draft: VoiceInventoryDraftItem): string {
    return getExpirationLabel(draft.expiration_date);
  }

  draftExpirationShortLabel(date: string | null | undefined): string {
    return getExpirationShortLabel(date);
  }

  draftExpirationStatus(draft: VoiceInventoryDraftItem) {
    return getExpirationStatus(draft.expiration_date);
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

  private setDraftExpanded(index: number, expanded: boolean): void {
    this.expandedDraftIndices.update((expandedIndices) => {
      const next = new Set(expandedIndices);
      if (expanded) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
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
