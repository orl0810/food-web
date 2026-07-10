import { Location } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MEAL_TYPE_LABELS } from '../../../core/models/meal-plan.model';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import { RecipeImageAutogenService } from '../../../core/services/recipe-image-autogen.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { OverlayPageComponent } from '../../../shared/components/overlay-page/overlay-page.component';
import { RecipeImageComponent } from '../../../shared/components/recipe-image/recipe-image.component';
import { RecentMealPlanRecipe } from '../../../shared/utils/meal-plan-recipe-history.utils';

@Component({
  selector: 'app-meal-plan-recent-page',
  standalone: true,
  imports: [
    RouterLink,
    RecipeImageComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    OverlayPageComponent,
  ],
  template: `
    <app-overlay-page title="Recently Added" (backClick)="goBack()">
      @if (loading()) {
        <app-loading-state message="Loading meal plan history..." />
      } @else if (visibleEntries().length === 0) {
        <app-empty-state
          title="No meals planned yet"
          description="Add recipes to your meal plan and they will show up here."
          actionLabel="Go to meal plan"
          (actionClick)="goToMealPlan()"
        />
      } @else {
        <div class="space-y-6">
          @for (entry of visibleEntries(); track entry.recipe.id) {
            <a
              [routerLink]="['/recipes', entry.recipe.id]"
              class="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div class="relative aspect-[16/10] w-full overflow-hidden bg-cream">
                <app-recipe-image [recipe]="entry.recipe" variant="card" />
              </div>

              <div class="px-4 py-4 sm:px-5">
                <h2 class="text-lg font-bold text-stone-900 group-hover:text-brand-800">
                  {{ entry.recipe.title }}
                </h2>

                <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
                  <span>Added {{ formatAddedDate(entry.addedAt) }}</span>
                  <span class="text-stone-300" aria-hidden="true">·</span>
                  <span>{{ mealTypeLabel(entry.mealType) }}</span>
                  <span class="text-stone-300" aria-hidden="true">·</span>
                  <span>Planned {{ formatPlannedDate(entry.plannedDate) }}</span>
                  @if (entry.recipe.prep_time_minutes) {
                    <span class="text-stone-300" aria-hidden="true">·</span>
                    <span>{{ entry.recipe.prep_time_minutes }} min prep</span>
                  }
                </p>
              </div>
            </a>
          }
        </div>
      }
    </app-overlay-page>
  `,
})
export class MealPlanRecentPageComponent implements OnInit {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly imageAutogen = inject(RecipeImageAutogenService);

  readonly loading = signal(true);

  readonly entries = computed(() => this.mealPlanService.recentRecipeHistory());

  readonly visibleEntries = computed(() => {
    this.imageAutogen.overrides();

    return this.entries().map((entry) => ({
      ...entry,
      recipe: this.imageAutogen.mergeRecipe(this.toAutogenRecipe(entry)),
    }));
  });

  constructor() {
    effect(() => {
      this.imageAutogen.ensureImages(
        this.entries().map((entry) => this.toAutogenRecipe(entry))
      );
    });
  }

  ngOnInit(): void {
    void this.loadHistory();
  }

  goBack(): void {
    this.location.back();
  }

  goToMealPlan(): void {
    void this.router.navigateByUrl('/meal-plan');
  }

  mealTypeLabel(mealType: RecentMealPlanRecipe['mealType']): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  formatAddedDate(isoDate: string): string {
    const parsed = Date.parse(isoDate);
    if (Number.isNaN(parsed)) {
      return isoDate;
    }

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(parsed));
  }

  formatPlannedDate(isoDate: string): string {
    const parsed = Date.parse(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsed)) {
      return isoDate;
    }

    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(parsed));
  }

  private async loadHistory(): Promise<void> {
    this.loading.set(true);
    await this.mealPlanService.loadRecentRecipeHistory();
    this.loading.set(false);
  }

  private toAutogenRecipe(entry: RecentMealPlanRecipe) {
    return {
      ...entry.recipe,
      image_status: entry.recipe.image_status ?? 'pending',
    };
  }
}
