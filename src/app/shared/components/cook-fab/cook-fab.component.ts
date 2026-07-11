import { Component, computed, inject } from '@angular/core';
import { ToCookService } from '../../../features/meal-plan/services/to-cook.service';

@Component({
  selector: 'app-cook-fab',
  standalone: true,
  template: `
    <button
      type="button"
      class="cook-fab"
      [attr.aria-label]="ariaLabel()"
      (click)="openPanel()"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="h-6 w-6"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z"
        />
      </svg>

      @if (count() > 0) {
        <span class="cook-fab-badge" aria-hidden="true">{{ count() }}</span>
      }
    </button>
  `,
})
export class CookFabComponent {
  private readonly toCookService = inject(ToCookService);

  readonly count = computed(() => this.toCookService.totalPendingCount());

  readonly ariaLabel = computed(() => {
    const total = this.count();
    if (total === 0) {
      return 'Open meals to cook';
    }
    return `Open meals to cook (${total})`;
  });

  openPanel(): void {
    this.toCookService.openPanel();
  }
}
