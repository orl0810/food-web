import { Component } from '@angular/core';

@Component({
  selector: 'app-recipe-card-skeleton',
  standalone: true,
  template: `
    <article class="card p-4" aria-hidden="true">
      <div class="flex gap-3">
        <div class="skeleton-shimmer h-20 w-20 shrink-0 rounded-lg"></div>
        <div class="min-w-0 flex-1 space-y-2">
          <div class="skeleton-shimmer h-4 w-3/5 rounded"></div>
          <div class="skeleton-shimmer h-3 w-full rounded"></div>
          <div class="skeleton-shimmer h-3 w-4/5 rounded"></div>
          <div class="mt-2 flex gap-2">
            <div class="skeleton-shimmer h-5 w-16 rounded-full"></div>
            <div class="skeleton-shimmer h-5 w-20 rounded-full"></div>
          </div>
        </div>
      </div>
      <div class="mt-3 flex gap-2">
        <div class="skeleton-shimmer h-9 flex-1 rounded-lg"></div>
        <div class="skeleton-shimmer h-9 flex-1 rounded-lg"></div>
      </div>
    </article>
  `,
  styles: `
    .skeleton-shimmer {
      background: linear-gradient(90deg, #f5f5f4 0%, #e7e5e4 50%, #f5f5f4 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `,
})
export class RecipeCardSkeletonComponent {}
