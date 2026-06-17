import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  Recipe,
  RecipeIngredientInput,
  RecipeInput,
} from '../models/recipe.model';
import { normalizeTags } from '../../shared/utils/tag.utils';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

const RECIPE_SELECT = '*, ingredients:recipe_ingredients(*)';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);

  private readonly recipesSignal = signal<Recipe[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly recipes = this.recipesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly allTags = computed(() => {
    const tags = new Set<string>();
    for (const recipe of this.recipesSignal()) {
      for (const tag of recipe.tags ?? []) {
        tags.add(tag);
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  });

  async loadRecipes(): Promise<void> {
    if (environment.useLocalApi) {
      return this.loadRecipesLocal();
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const { data, error } = await client
      .from('recipes')
      .select(RECIPE_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set('Could not load your recipes. Please try again.');
      return;
    }

    this.recipesSignal.set(this.normalizeRecipes(data));
  }

  async getRecipes(): Promise<Recipe[]> {
    await this.loadRecipes();
    return this.recipesSignal();
  }

  async getRecipeById(
    id: string
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.getRecipeByIdLocal(id);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { recipe: null, error: 'You must be signed in to view recipes.' };
    }

    const { data, error } = await client
      .from('recipes')
      .select(RECIPE_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { recipe: null, error: 'Could not load this recipe. Please try again.' };
    }

    if (!data) {
      return { recipe: null, error: 'Recipe not found.' };
    }

    return { recipe: this.normalizeRecipe(data), error: null };
  }

  async createRecipe(
    recipeData: RecipeInput,
    ingredients: RecipeIngredientInput[]
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.createRecipeLocal(recipeData, ingredients);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { recipe: null, error: 'You must be signed in to create recipes.' };
    }

    this.errorSignal.set(null);

    const { data: created, error: createError } = await client
      .from('recipes')
      .insert({ ...this.toRecipeRow(recipeData), user_id: userId })
      .select('*')
      .single();

    if (createError || !created) {
      const message = 'Could not save this recipe. Please try again.';
      this.errorSignal.set(message);
      return { recipe: null, error: message };
    }

    const recipeId = (created as Recipe).id;
    const insertError = await this.replaceIngredients(recipeId, ingredients);
    if (insertError) {
      return { recipe: null, error: insertError };
    }

    await this.loadRecipes();
    const { recipe } = await this.getRecipeById(recipeId);
    return { recipe, error: null };
  }

  async updateRecipe(
    id: string,
    recipeData: RecipeInput,
    ingredients: RecipeIngredientInput[]
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.updateRecipeLocal(id, recipeData, ingredients);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { recipe: null, error: 'You must be signed in to update recipes.' };
    }

    this.errorSignal.set(null);

    const { error: updateError } = await client
      .from('recipes')
      .update(this.toRecipeRow(recipeData))
      .eq('id', id)
      .eq('user_id', userId);

    if (updateError) {
      const message = 'Could not update this recipe. Please try again.';
      this.errorSignal.set(message);
      return { recipe: null, error: message };
    }

    const ingredientError = await this.replaceIngredients(id, ingredients);
    if (ingredientError) {
      return { recipe: null, error: ingredientError };
    }

    await this.loadRecipes();
    const { recipe } = await this.getRecipeById(id);
    return { recipe, error: null };
  }

  async deleteRecipe(id: string): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.deleteRecipeLocal(id);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in to delete recipes.' };
    }

    this.errorSignal.set(null);

    const { error } = await client
      .from('recipes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      const message = 'Could not delete this recipe. Please try again.';
      this.errorSignal.set(message);
      return { error: message };
    }

    this.recipesSignal.update((recipes) => recipes.filter((recipe) => recipe.id !== id));
    return { error: null };
  }

  async updateRecipeRating(
    id: string,
    rating: number | null
  ): Promise<{ error: string | null }> {
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return { error: 'Rating must be between 1 and 5 stars.' };
    }

    const previousRecipes = this.recipesSignal();
    this.applyRatingToSignal(id, rating);

    if (environment.useLocalApi) {
      return this.updateRecipeRatingLocal(id, rating, previousRecipes);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      this.recipesSignal.set(previousRecipes);
      return { error: 'You must be signed in to rate recipes.' };
    }

    const { error } = await client
      .from('recipes')
      .update({ rating })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      this.recipesSignal.set(previousRecipes);
      return { error: 'Could not save your rating. Please try again.' };
    }

    return { error: null };
  }

  private async loadRecipesLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.getRecipes();
      this.recipesSignal.set(this.normalizeRecipes(data));
    } catch {
      this.errorSignal.set('Could not load your recipes. Please try again.');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async getRecipeByIdLocal(
    id: string
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { recipe: null, error: 'You must be signed in to view recipes.' };
    }

    try {
      const data = await this.localApiService.getRecipe(id);
      return { recipe: this.normalizeRecipe(data), error: null };
    } catch {
      return { recipe: null, error: 'Recipe not found.' };
    }
  }

  private async createRecipeLocal(
    recipeData: RecipeInput,
    ingredients: RecipeIngredientInput[]
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { recipe: null, error: 'You must be signed in to create recipes.' };
    }

    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.createRecipe({
        ...this.toRecipeRow(recipeData),
        ingredients: this.cleanIngredients(ingredients),
      });
      const recipe = this.normalizeRecipe(data);
      await this.loadRecipes();
      return { recipe, error: null };
    } catch {
      const message = 'Could not save this recipe. Please try again.';
      this.errorSignal.set(message);
      return { recipe: null, error: message };
    }
  }

  private async updateRecipeLocal(
    id: string,
    recipeData: RecipeInput,
    ingredients: RecipeIngredientInput[]
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { recipe: null, error: 'You must be signed in to update recipes.' };
    }

    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.updateRecipe(id, {
        ...this.toRecipeRow(recipeData),
        ingredients: this.cleanIngredients(ingredients),
      });
      const recipe = this.normalizeRecipe(data);
      await this.loadRecipes();
      return { recipe, error: null };
    } catch {
      const message = 'Could not update this recipe. Please try again.';
      this.errorSignal.set(message);
      return { recipe: null, error: message };
    }
  }

  private async deleteRecipeLocal(id: string): Promise<{ error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { error: 'You must be signed in to delete recipes.' };
    }

    this.errorSignal.set(null);

    try {
      await this.localApiService.deleteRecipe(id);
      this.recipesSignal.update((recipes) => recipes.filter((recipe) => recipe.id !== id));
      return { error: null };
    } catch {
      const message = 'Could not delete this recipe. Please try again.';
      this.errorSignal.set(message);
      return { error: message };
    }
  }

  private async updateRecipeRatingLocal(
    id: string,
    rating: number | null,
    previousRecipes: Recipe[]
  ): Promise<{ error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      this.recipesSignal.set(previousRecipes);
      return { error: 'You must be signed in to rate recipes.' };
    }

    try {
      await this.localApiService.updateRecipeRating(id, rating);
      return { error: null };
    } catch {
      this.recipesSignal.set(previousRecipes);
      return { error: 'Could not save your rating. Please try again.' };
    }
  }

  private applyRatingToSignal(id: string, rating: number | null): void {
    this.recipesSignal.update((recipes) =>
      recipes.map((recipe) => (recipe.id === id ? { ...recipe, rating } : recipe))
    );
  }

  private async replaceIngredients(
    recipeId: string,
    ingredients: RecipeIngredientInput[]
  ): Promise<string | null> {
    const client = this.supabaseService.getClient();
    if (!client) {
      return 'You must be signed in to save ingredients.';
    }

    const { error: deleteError } = await client
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);

    if (deleteError) {
      const message = 'Could not save the recipe ingredients. Please try again.';
      this.errorSignal.set(message);
      return message;
    }

    const rows = this.cleanIngredients(ingredients).map((ingredient) => ({
      recipe_id: recipeId,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    }));

    if (rows.length === 0) {
      return null;
    }

    const { error: insertError } = await client.from('recipe_ingredients').insert(rows);

    if (insertError) {
      const message = 'Could not save the recipe ingredients. Please try again.';
      this.errorSignal.set(message);
      return message;
    }

    return null;
  }

  private cleanIngredients(
    ingredients: RecipeIngredientInput[]
  ): { name: string; quantity: number | null; unit: string | null }[] {
    return ingredients
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit?.trim() || null,
      }))
      .filter((ingredient) => ingredient.name.length > 0);
  }

  private toRecipeRow(recipeData: RecipeInput) {
    return {
      title: recipeData.title.trim(),
      description: recipeData.description?.trim() || null,
      prep_time_minutes: recipeData.prep_time_minutes ?? null,
      portions: recipeData.portions ?? null,
      tags: normalizeTags(recipeData.tags ?? []),
    };
  }

  private normalizeRecipes(data: unknown): Recipe[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((row) => this.normalizeRecipe(row));
  }

  private normalizeRecipe(row: unknown): Recipe {
    const recipe = row as Recipe;
    return {
      ...recipe,
      tags: normalizeTags(recipe.tags ?? []),
      rating: this.normalizeRating(recipe.rating),
      ingredients: [...(recipe.ingredients ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    };
  }

  private normalizeRating(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      return null;
    }
    return num;
  }
}
