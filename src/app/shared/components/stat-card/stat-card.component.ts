import { Component, input } from '@angular/core';

export type StatCardVariant = 'default' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  host: { class: 'block h-full' },
  template: `
    <div
      class="h-full rounded-xl border border-stone-200 bg-card p-5 shadow-sm"
      [class.border-brand-200]="variant() === 'success'"
      [class.border-amber-200]="variant() === 'warning'"
      [class.border-red-200]="variant() === 'danger'"
    >
      <p class="text-sm font-medium text-muted">{{ label() }}</p>
      <p class="mt-2 text-3xl font-semibold text-stone-900">{{ value() }}</p>
      @if (subtitle()) {
        <p class="mt-1 text-sm text-stone-600">{{ subtitle() }}</p>
      }
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly subtitle = input<string>();
  readonly variant = input<StatCardVariant>('default');
}
