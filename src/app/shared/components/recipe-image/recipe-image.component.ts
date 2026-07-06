import { Component, computed, inject, input, signal } from '@angular/core';
import { Recipe } from '../../../core/models/recipe.model';
import {
  RecipeImagePlaceholderKey,
  RecipeImageUrlService,
} from '../../../core/services/recipe-image-url.service';

@Component({
  selector: 'app-recipe-image',
  standalone: true,
  template: `
    <figure
      class="overflow-hidden bg-cream ring-1 ring-sage/30"
      [class]="containerClass()"
      [attr.aria-label]="ariaLabel()"
    >
      @if (showImage()) {
        <img
          [src]="imageUrl()!"
          [alt]="altText()"
          class="h-full w-full object-cover"
          (error)="onImageError()"
        />
      } @else if (isLoading()) {
        <div class="flex h-full w-full flex-col items-center justify-center gap-2 bg-cream animate-pulse">
          <div class="h-8 w-8 rounded-full bg-stone-200/80"></div>
          <span class="sr-only">{{ loadingLabel() }}</span>
        </div>
      } @else {
        <div
          class="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-cream px-2 text-center"
          role="img"
          [attr.aria-label]="fallbackAriaLabel()"
        >
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 ring-1 ring-sage/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              class="h-5 w-5 text-sage-dark"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                [attr.d]="placeholderIconPath()"
              />
            </svg>
          </span>
          @if (variant() === 'hero') {
            <span class="text-xs font-medium text-stone-500">{{ fallbackLabel() }}</span>
          }
          <span class="sr-only">{{ fallbackAriaLabel() }}</span>
        </div>
      }
    </figure>
  `,
})
export class RecipeImageComponent {
  private readonly recipeImageUrlService = inject(RecipeImageUrlService);

  readonly recipe = input.required<Recipe>();
  readonly variant = input<'thumbnail' | 'hero' | 'card'>('hero');
  readonly alt = input<string | null>(null);

  readonly imageLoadError = signal(false);

  readonly imageUrl = computed(() => this.recipeImageUrlService.getRecipeImageUrl(this.recipe()));

  readonly isLoading = computed(() =>
    this.recipeImageUrlService.isLoadingState(this.recipe())
  );

  readonly showImage = computed(
    () =>
      this.recipeImageUrlService.shouldShowImage(this.recipe()) &&
      !this.imageLoadError() &&
      this.imageUrl() !== null
  );

  readonly altText = computed(
    () => this.alt() ?? `${this.recipe().title} recipe image`
  );

  readonly containerClass = computed(() => {
    switch (this.variant()) {
      case 'hero':
        return 'w-full rounded-2xl aspect-[16/10]';
      case 'card':
        return 'h-full w-full rounded-none';
      default:
        return 'h-14 w-14 shrink-0 rounded-xl';
    }
  });

  readonly placeholderKey = computed(() =>
    this.recipeImageUrlService.getFallbackImageForRecipe(this.recipe())
  );

  readonly loadingLabel = computed(() =>
    this.recipe().image_status === 'generating' ? 'Creating image…' : 'Image coming soon'
  );

  readonly fallbackLabel = computed(() => {
    if (this.recipeImageUrlService.isFailedState(this.recipe()) || this.imageLoadError()) {
      return 'Recipe image unavailable';
    }
    return 'Image coming soon';
  });

  readonly fallbackAriaLabel = computed(() => {
    if (this.recipeImageUrlService.isFailedState(this.recipe()) || this.imageLoadError()) {
      return 'Recipe image unavailable';
    }
    return 'Image coming soon';
  });

  readonly ariaLabel = computed(() => {
    if (this.showImage()) {
      return this.altText();
    }
    if (this.isLoading()) {
      return this.loadingLabel();
    }
    return this.fallbackAriaLabel();
  });

  onImageError(): void {
    this.imageLoadError.set(true);
  }

  placeholderIconPath(): string {
    const paths: Record<RecipeImagePlaceholderKey, string> = {
      breakfast:
        'M6 10h12M8 14h8M12 6v12M9 3h6a2 2 0 0 1 2 2v1H7V5a2 2 0 0 1 2-2z',
      lunch:
        'M4 10h16M6 14h12M8 18h8M12 4c2 0 3 1.5 3 3v3H9V7c0-1.5 1-3 3-3z',
      dinner:
        'M5 11h14M7 15h10M9 19h6M12 5a3 3 0 0 1 3 3v3H9V8a3 3 0 0 1 3-3z',
      snack:
        'M8 12h8M10 16h4M12 8v8M9 6h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
      default:
        'M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1ZM6 17h12',
    };

    return paths[this.placeholderKey()];
  }
}
