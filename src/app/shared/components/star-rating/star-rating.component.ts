import { Component, computed, input, output, signal } from '@angular/core';

const MAX_STARS = 5;

@Component({
  selector: 'app-star-rating',
  standalone: true,
  template: `
    <div
      class="inline-flex items-center gap-0.5"
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
      (mouseleave)="hoverRating.set(null)"
    >
      @for (star of stars; track star) {
        <button
          type="button"
          class="rounded p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 disabled:cursor-default"
          [class]="starButtonClass()"
          [class.text-amber-400]="isFilled(star)"
          [class.text-stone-300]="!isFilled(star)"
          [disabled]="readonly()"
          [attr.aria-checked]="displayRating() === star"
          [attr.aria-label]="starLabel(star)"
          (click)="onStarClick($event, star)"
          (mouseenter)="onStarHover(star)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            [attr.fill]="isFilled(star) ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.5"
            [class]="starIconClass()"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
            />
          </svg>
        </button>
      }
    </div>
  `,
})
export class StarRatingComponent {
  readonly rating = input<number | null>(null);
  readonly readonly = input(false);
  readonly size = input<'sm' | 'md'>('md');

  readonly ratingChange = output<number | null>();

  readonly stars = Array.from({ length: MAX_STARS }, (_, index) => index + 1);
  readonly hoverRating = signal<number | null>(null);

  readonly displayRating = computed(() => this.hoverRating() ?? this.rating());

  readonly ariaLabel = computed(() => {
    const value = this.rating();
    return value ? `Rated ${value} out of ${MAX_STARS} stars` : `Rate up to ${MAX_STARS} stars`;
  });

  readonly starButtonClass = computed(() =>
    this.readonly() ? 'cursor-default' : 'cursor-pointer hover:scale-105'
  );

  readonly starIconClass = computed(() => {
    const sizeClass = this.size() === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    return `${sizeClass} transition-colors`;
  });

  isFilled(star: number): boolean {
    const value = this.displayRating();
    return value !== null && star <= value;
  }

  starLabel(star: number): string {
    if (this.readonly()) {
      return `${star} star${star === 1 ? '' : 's'}`;
    }
    return `Rate ${star} star${star === 1 ? '' : 's'}`;
  }

  onStarHover(star: number): void {
    if (this.readonly()) {
      return;
    }
    this.hoverRating.set(star);
  }

  onStarClick(event: Event, star: number): void {
    event.stopPropagation();
    if (this.readonly()) {
      return;
    }

    const nextRating = this.rating() === star ? null : star;
    this.hoverRating.set(null);
    this.ratingChange.emit(nextRating);
  }
}
