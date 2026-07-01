import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecipeCategory } from '../../../../core/models/recipe.model';
import {
  recipeCategoryIconUrl,
  SLIDER_RECIPE_CATEGORIES,
} from '../../../../shared/utils/recipe-category-icon.utils';

const CATEGORY_COLORS: Record<RecipeCategory, string> = {
  Burgers: '#7a3b2e',
  Healthy: '#2d6a4f',
  Oriental: '#8b4513',
  Chicken: '#c45c26',
  Meat: '#6b2d3d',
  Breakfast: '#d4a017',
  Asian: '#b83232',
  Dessert: '#9b59b6',
  Italian: '#1e6b52',
  Oats: '#5c4033',
  'Yogurt Bowl': '#2d5a4a',
  Eggs: '#1e3a5f',
  Toast: '#6b3a2a',
  Cereal: '#4a3728',
  Smoothie: '#5b2c6f',
  'Rice Bowl': '#1a5c5c',
  Pasta: '#8b3a3a',
  Soup: '#2e4a6e',
  Salad: '#2d6a4f',
  Wrap: '#6b4c2a',
  Sandwich: '#4a3d6b',
  'Main Dish': '#5c2d4a',
  'Light Dinner': '#3d5c6b',
  'Dinner Main': '#4a2d3d',
  Snack: '#5a4a2e',
};

const LOOP_COPIES = 3;

@Component({
  selector: 'app-meal-inspiration-slider',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section aria-label="Meal inspiration categories">
      <h2 class="section-title mb-3">Get inspired</h2>

      <div
        #scrollContainer
        class="meal-inspiration-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1"
        role="list"
        (scroll)="onScroll()"
      >
        @for (category of loopedCategories(); track $index) {
          <a
            routerLink="/recipes"
            [queryParams]="{ category }"
            class="group block w-[76px] shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            role="listitem"
            data-category-tile
            [attr.data-category]="category"
            [attr.aria-label]="'Browse ' + category + ' recipes'"
          >
            <div
              class="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl transition-transform group-hover:scale-[1.03] group-active:scale-[0.98]"
              [style.background-color]="colorFor(category)"
              aria-hidden="true"
            >
              @if (isIconLoaded(category)) {
                <img
                  [src]="iconUrl(category)"
                  alt=""
                  class="h-full w-full object-contain p-1"
                />
              }
            </div>
            <p class="mt-1.5 text-center text-xs font-medium text-stone-700">
              {{ category }}
            </p>
          </a>
        }
      </div>
    </section>
  `,
  styles: `
    .meal-inspiration-scroll {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .meal-inspiration-scroll::-webkit-scrollbar {
      display: none;
    }
  `,
})
export class MealInspirationSliderComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly scrollContainer =
    viewChild<ElementRef<HTMLElement>>('scrollContainer');

  private readonly categories = [...SLIDER_RECIPE_CATEGORIES];
  private setWidth = 0;
  private isAdjustingScroll = false;
  private iconObserver: IntersectionObserver | null = null;

  readonly loadedCategories = signal<ReadonlySet<RecipeCategory>>(new Set());

  readonly loopedCategories = computed(() =>
    Array.from({ length: LOOP_COPIES }, () => this.categories).flat()
  );

  constructor() {
    afterNextRender(() => {
      this.measureAndCenter();
      this.setupIconObserver();
    });

    this.destroyRef.onDestroy(() => {
      this.isAdjustingScroll = false;
      this.iconObserver?.disconnect();
      this.iconObserver = null;
    });
  }

  colorFor(category: RecipeCategory): string {
    return CATEGORY_COLORS[category];
  }

  iconUrl(category: RecipeCategory): string {
    return recipeCategoryIconUrl(category);
  }

  isIconLoaded(category: RecipeCategory): boolean {
    return this.loadedCategories().has(category);
  }

  onScroll(): void {
    if (this.isAdjustingScroll || this.setWidth <= 0) {
      return;
    }

    const container = this.scrollContainer()?.nativeElement;
    if (!container) {
      return;
    }

    const { scrollLeft } = container;
    const buffer = 4;

    if (scrollLeft <= buffer) {
      this.jumpScroll(container, scrollLeft + this.setWidth);
      return;
    }

    if (scrollLeft >= this.setWidth * 2 - buffer) {
      this.jumpScroll(container, scrollLeft - this.setWidth);
    }
  }

  private measureAndCenter(): void {
    const container = this.scrollContainer()?.nativeElement;
    if (!container) {
      return;
    }

    this.setWidth = container.scrollWidth / LOOP_COPIES;
    if (this.setWidth > 0) {
      this.jumpScroll(container, this.setWidth);
    }
  }

  private jumpScroll(container: HTMLElement, targetLeft: number): void {
    this.isAdjustingScroll = true;
    container.scrollLeft = targetLeft;
    requestAnimationFrame(() => {
      this.isAdjustingScroll = false;
      this.setupIconObserver();
    });
  }

  private setupIconObserver(): void {
    this.iconObserver?.disconnect();
    this.iconObserver = null;

    const container = this.scrollContainer()?.nativeElement;
    if (!container) {
      return;
    }

    this.iconObserver = new IntersectionObserver(
      (entries) => {
        const toLoad = new Set<RecipeCategory>();

        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const category = entry.target.getAttribute('data-category') as RecipeCategory | null;
          if (category && !this.loadedCategories().has(category)) {
            toLoad.add(category);
          }
        }

        if (toLoad.size === 0) {
          return;
        }

        this.loadedCategories.update((current) => {
          const next = new Set(current);
          for (const category of toLoad) {
            next.add(category);
          }
          return next;
        });
      },
      {
        root: container,
        rootMargin: '0px 80px 0px 80px',
        threshold: 0.1,
      }
    );

    container.querySelectorAll('[data-category-tile]').forEach((tile) => {
      this.iconObserver?.observe(tile);
    });
  }
}
