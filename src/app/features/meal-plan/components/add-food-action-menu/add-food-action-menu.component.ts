import { Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { VoiceInputService } from '../../../../core/services/voice-input.service';

export type FoodActionChoice = 'recipe' | 'manual' | 'voice' | 'photo' | 'barcode';

@Component({
  selector: 'app-add-food-action-menu',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-food-menu-title"
      (click)="cancelled.emit()"
    >
      <div
        class="card w-full max-w-lg overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="border-b border-stone-100 p-4">
          <h2 id="add-food-menu-title" class="text-base font-semibold text-stone-900">Add food</h2>
          <p class="mt-0.5 text-sm text-stone-600">Log what you ate or save a reusable recipe.</p>
        </div>

        <div class="space-y-2 p-4">
          @for (option of options; track option.id) {
            <button
              type="button"
              class="flex w-full items-start gap-3 rounded-xl border border-stone-200 p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="option.disabled"
              (click)="select(option.id)"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
                aria-hidden="true"
              >
                @switch (option.id) {
                  @case ('barcode') { <span class="text-xl" aria-hidden="true">▥</span> }
                  @case ('recipe') {
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                  }
                  @case ('manual') {
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  }
                  @case ('voice') {
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  }
                  @case ('photo') {
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 0 1-8.998 0A4.5 4.5 0 0 1 16.5 12.75Z" />
                    </svg>
                  }
                }
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-stone-900">{{ option.title }}</span>
                <span class="mt-0.5 block text-sm text-stone-600">{{ option.description }}</span>
                @if (option.hint) {
                  <span class="mt-1 block text-xs text-amber-700">{{ option.hint }}</span>
                }
              </span>
            </button>
          }
        </div>

        <div class="border-t border-stone-100 p-4">
          <button
            type="button"
            class="w-full rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AddFoodActionMenuComponent {
  private readonly router = inject(Router);
  readonly voiceInput = inject(VoiceInputService);

  readonly selected = output<FoodActionChoice>();
  readonly cancelled = output<void>();

  readonly options: {
    id: FoodActionChoice;
    title: string;
    description: string;
    hint?: string;
    disabled?: boolean;
  }[] = [
    { id: 'barcode', title: 'Scan barcode', description: 'Scan a packaged food and choose your serving.' },
    {
      id: 'recipe',
      title: 'Create reusable recipe',
      description: 'Save a meal you want to use again.',
    },
    {
      id: 'manual',
      title: 'Log food manually',
      description: 'Quickly add something you ate today.',
    },
    {
      id: 'voice',
      title: 'Log with voice',
      description: "Say what you ate and we'll create a quick entry.",
      hint: this.voiceInput.isSupported()
        ? undefined
        : 'Voice input is not available on this browser.',
      disabled: !this.voiceInput.isSupported(),
    },
    {
      id: 'photo',
      title: 'Log with photo',
      description: 'Upload a photo and add it to your day.',
    },
  ];

  select(choice: FoodActionChoice): void {
    if (choice === 'recipe') {
      void this.router.navigate(['/recipes/new']);
      this.cancelled.emit();
      return;
    }
    this.selected.emit(choice);
  }
}
