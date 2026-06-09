import { Component, computed, inject, input } from '@angular/core';
import { FoodIconService } from '../../../core/services/food-icon.service';

export type FoodIconBadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-food-icon-badge',
  standalone: true,
  template: `
    <span
      class="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200/80"
      [class]="sizeClasses()"
      aria-hidden="true"
    >
      <span [class]="emojiClasses()">{{ icon() }}</span>
    </span>
  `,
})
export class FoodIconBadgeComponent {
  private readonly foodIconService = inject(FoodIconService);

  readonly name = input.required<string>();
  readonly category = input<string | null | undefined>(null);
  readonly size = input<FoodIconBadgeSize>('md');

  readonly icon = computed(() => {
    this.foodIconService.iconDataVersion();
    return this.foodIconService.resolveIcon(this.name(), this.category());
  });

  readonly sizeClasses = computed(() => {
    switch (this.size()) {
      case 'sm':
        return 'h-7 w-7';
      case 'lg':
        return 'h-12 w-12 sm:h-14 sm:w-14';
      default:
        return 'h-9 w-9';
    }
  });

  readonly emojiClasses = computed(() => {
    switch (this.size()) {
      case 'sm':
        return 'text-base leading-none';
      case 'lg':
        return 'text-2xl leading-none sm:text-3xl';
      default:
        return 'text-lg leading-none';
    }
  });
}
