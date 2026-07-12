import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-upgrade-prompt',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="rounded-lg border border-brand-200 bg-brand-50 p-4">
      <h3 class="font-semibold text-brand-900">{{ title() }}</h3>
      <p class="mt-1 text-sm text-brand-800">{{ message() }}</p>
      @if (usageLabel()) {
        <p class="mt-2 text-xs text-brand-700">{{ usageLabel() }}</p>
      }
      <a routerLink="/pricing" class="btn-primary-sm mt-3 inline-flex">View plans</a>
    </div>
  `,
})
export class UpgradePromptComponent {
  readonly title = input('Upgrade to continue');
  readonly message = input('This feature requires premium access.');
  readonly usageLabel = input<string | null>(null);
}
