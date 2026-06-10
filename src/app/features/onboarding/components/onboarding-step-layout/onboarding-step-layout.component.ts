import { Component, input } from '@angular/core';

@Component({
  selector: 'app-onboarding-step-layout',
  standalone: true,
  template: `
    <div class="mx-auto w-full max-w-lg">
      @if (title()) {
        <h1 class="page-title">{{ title() }}</h1>
      }
      @if (subtitle()) {
        <p class="page-subtitle">{{ subtitle() }}</p>
      }
      @if (helper()) {
        <p class="mt-3 text-sm text-stone-500">{{ helper() }}</p>
      }
      <div class="mt-6">
        <ng-content />
      </div>
    </div>
  `,
})
export class OnboardingStepLayoutComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly helper = input<string>('');
}
