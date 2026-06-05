import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
      <h3 class="text-lg font-medium text-stone-900">{{ title() }}</h3>
      <p class="mx-auto mt-2 max-w-md text-sm text-stone-600">{{ description() }}</p>
      @if (actionLabel()) {
        <button
          type="button"
          class="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          (click)="actionClick.emit()"
        >
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly actionLabel = input<string>();
  readonly actionClick = output<void>();
}
