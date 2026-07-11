import { Component, input, output } from '@angular/core';
import { AdminDateRangePreset } from '../../models/admin-analytics.model';

interface DateRangeOption {
  value: AdminDateRangePreset;
  label: string;
}

@Component({
  selector: 'app-admin-date-range-filter',
  standalone: true,
  template: `
    <div class="flex flex-wrap gap-2" role="group" aria-label="Date range">
      @for (option of options; track option.value) {
        <button
          type="button"
          class="filter-pill"
          [class.filter-pill-active]="selected() === option.value"
          [class.filter-pill-inactive]="selected() !== option.value"
          [attr.aria-pressed]="selected() === option.value"
          (click)="presetChange.emit(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class AdminDateRangeFilterComponent {
  readonly selected = input.required<AdminDateRangePreset>();
  readonly presetChange = output<AdminDateRangePreset>();

  readonly options: DateRangeOption[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ];
}
