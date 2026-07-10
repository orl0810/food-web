import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Recipe } from '../models/recipe.model';
import { RecipeService } from './recipe.service';

export type RecipeImageAutogenTarget = Pick<
  Recipe,
  'id' | 'image_url' | 'image_storage_key' | 'image_status'
>;

export type RecipeImageOverride = Pick<
  Recipe,
  'image_url' | 'image_storage_key' | 'image_status'
>;

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20;

@Injectable({ providedIn: 'root' })
export class RecipeImageAutogenService implements OnDestroy {
  private readonly recipeService = inject(RecipeService);

  private readonly overridesSignal = signal<Map<string, RecipeImageOverride>>(new Map());
  private readonly requestedIds = new Set<string>();
  private readonly pollTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly pollAttempts = new Map<string, number>();

  readonly overrides = this.overridesSignal.asReadonly();

  ngOnDestroy(): void {
    for (const recipeId of this.pollTimers.keys()) {
      this.stopPolling(recipeId);
    }
  }

  ensureImages(recipes: RecipeImageAutogenTarget[]): void {
    if (environment.useLocalApi) {
      return;
    }

    for (const recipe of recipes) {
      if (this.shouldAutoGenerate(recipe)) {
        void this.triggerGeneration(recipe);
        continue;
      }

      if (
        recipe.image_status === 'generating' ||
        recipe.image_status === 'pending'
      ) {
        this.startPolling(recipe.id);
      }
    }
  }

  mergeRecipe<T extends RecipeImageAutogenTarget>(recipe: T): T {
    const override = this.overridesSignal().get(recipe.id);
    if (!override) {
      return recipe;
    }

    return { ...recipe, ...override };
  }

  private shouldAutoGenerate(recipe: RecipeImageAutogenTarget): boolean {
    if (this.requestedIds.has(recipe.id)) {
      return false;
    }

    if (recipe.image_status === 'completed') {
      return false;
    }

    if (recipe.image_status === 'failed') {
      return false;
    }

    if (recipe.image_status === 'generating') {
      return false;
    }

    return true;
  }

  private async triggerGeneration(recipe: RecipeImageAutogenTarget): Promise<void> {
    this.requestedIds.add(recipe.id);
    this.setOverride(recipe.id, {
      image_url: recipe.image_url,
      image_storage_key: recipe.image_storage_key,
      image_status: 'generating',
    });

    const { error } = await this.recipeService.requestRecipeImageGeneration(recipe.id);
    if (error) {
      this.setOverride(recipe.id, {
        image_url: recipe.image_url,
        image_storage_key: recipe.image_storage_key,
        image_status: recipe.image_status,
      });
      return;
    }

    this.startPolling(recipe.id);
  }

  private startPolling(recipeId: string): void {
    if (this.pollTimers.has(recipeId)) {
      return;
    }

    this.pollAttempts.set(recipeId, 0);

    const timer = setInterval(() => {
      void this.pollOnce(recipeId);
    }, POLL_INTERVAL_MS);

    this.pollTimers.set(recipeId, timer);
  }

  private async pollOnce(recipeId: string): Promise<void> {
    const attempts = (this.pollAttempts.get(recipeId) ?? 0) + 1;
    this.pollAttempts.set(recipeId, attempts);

    if (attempts > MAX_POLL_ATTEMPTS) {
      this.stopPolling(recipeId);
      return;
    }

    const { recipe, error } = await this.recipeService.getRecipeById(recipeId);
    if (error || !recipe) {
      this.stopPolling(recipeId);
      return;
    }

    this.setOverride(recipeId, {
      image_url: recipe.image_url,
      image_storage_key: recipe.image_storage_key,
      image_status: recipe.image_status,
    });

    if (recipe.image_status === 'completed' || recipe.image_status === 'failed') {
      this.stopPolling(recipeId);
    }
  }

  private stopPolling(recipeId: string): void {
    const timer = this.pollTimers.get(recipeId);
    if (timer) {
      clearInterval(timer);
      this.pollTimers.delete(recipeId);
    }

    this.pollAttempts.delete(recipeId);
  }

  private setOverride(recipeId: string, override: RecipeImageOverride): void {
    this.overridesSignal.update((current) => {
      const next = new Map(current);
      next.set(recipeId, override);
      return next;
    });
  }
}
