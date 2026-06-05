import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  template: `
    <div class="flex items-center justify-center gap-3 py-12 text-sm text-stone-600">
      <span
        class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600"
        aria-hidden="true"
      ></span>
      <span>{{ message() }}</span>
    </div>
  `,
})
export class LoadingStateComponent {
  readonly message = input('Loading...');
}
