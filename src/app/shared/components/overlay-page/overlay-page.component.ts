import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-overlay-page',
  standalone: true,
  template: `
    <div class="overlay-page">
      <div class="overlay-page-inner mx-auto max-w-5xl px-4 py-6 pb-28 md:pb-6">
        <header class="mb-6 flex items-center gap-3">
          <button
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 transition-colors hover:bg-stone-50"
            [attr.aria-label]="backLabel()"
            (click)="backClick.emit()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="h-5 w-5"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.56 9.5h7.69a.75.75 0 0 1 0 1.5H8.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
          <h1 class="text-2xl font-bold tracking-tight text-stone-900">{{ title() }}</h1>
        </header>

        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .overlay-page {
      position: fixed;
      inset: 0;
      z-index: var(--z-index-overlay-page);
      overflow-y: auto;
      background-color: #fafaf9;
      padding-top: var(--safe-area-top);
      padding-right: var(--safe-area-right);
      padding-left: var(--safe-area-left);
    }
  `,
})
export class OverlayPageComponent {
  readonly title = input.required<string>();
  readonly backLabel = input('Go back');
  readonly backClick = output<void>();
}
