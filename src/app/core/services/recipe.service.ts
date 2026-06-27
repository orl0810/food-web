import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  Recipe,
  RecipeImageMetadataUpdate,
  RecipeImageStatus,
  RecipeIngredientInput,
  RecipeInput,
  RecipeNutrition,
  RecipeSearchFilters,
} from '../models/recipe.model';
import { normalizeTags } from '../../shared/utils/tag.utils';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { RecipeImageService } from './recipe-image.service';
import { RecipeImageUrlService } from './recipe-image-url.service';
import { RecipeNutritionService } from './recipe-nutrition.service';
import { SupabaseService } from './supabase.service';

const RECIPE_SELECT = '*, ingredients:recipe_ingredients(*)';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);
  private readonly recipeNutritionService = inject(RecipeNutritionService);
  private readonly recipeImageUrlService = inject(RecipeImageUrlService);
  private readonly recipeImageService = inject(RecipeImageService);

  private readonly recipesSignal = signal<Recipe[]>([]);
  private readonly baseRecipesSignal = signal<Recipe[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly baseLoadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly baseErrorSignal = signal<string | null>(null);

  readonly recipes = this.recipesSignal.asReadonly();
  readonly baseRecipes = this.baseRecipesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly baseLoading = this.baseLoadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly baseError = this.baseErrorSignal.asReadonly();

  readonly allVisibleRecipes = computed(() => [
    ...this.recipesSignal(),
    ...this.baseRecipesSignal(),
  ]);

  readonly allTags = computed(() => {
    const tags = new Set<string>();
    for (const recipe of [...this.recipesSignal(), ...this.baseRecipesSignal()]) {
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
      .eq('is_base_recipe', false)
      .order('created_at', { ascending: false });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set('Could not load your recipes. Please try again.');
      return;
    }

    this.recipesSignal.set(this.normalizeRecipes(data));
  }

  async loadBaseRecipes(): Promise<void> {
    if (environment.useLocalApi) {
      return this.loadBaseRecipesLocal();
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return;
    }

    this.baseLoadingSignal.set(true);
    this.baseErrorSignal.set(null);

    const { data, error } = await client
      .from('recipes')
      .select(RECIPE_SELECT)
      .eq('is_base_recipe', true)
      .order('meal_type', { ascending: true })
      .order('title', { ascending: true });

    this.baseLoadingSignal.set(false);

    if (error) {
      this.baseErrorSignal.set('Could not load starter recipes. Please try again.');
      return;
    }

    this.baseRecipesSignal.set(this.normalizeRecipes(data));
  }

  async getRecipes(): Promise<Recipe[]> {
    await this.loadRecipes();
    return this.recipesSignal();
  }

  getUserRecipes(): Recipe[] {
    return this.recipesSignal();
  }

  getAllVisibleRecipes(): Recipe[] {
    return this.allVisibleRecipes();
  }

  searchRecipes(filters: RecipeSearchFilters): Recipe[] {
    const sourceTab = filters.sourceTab ?? 'all';
    let list: Recipe[];

    if (sourceTab === 'mine') {
      list = this.recipesSignal();
    } else if (sourceTab === 'starter') {
      list = this.baseRecipesSignal();
    } else {
      list = this.allVisibleRecipes();
    }

    const search = filters.search?.trim().toLowerCase() ?? '';
    const mealType = filters.mealType ?? null;
    const category = filters.category ?? null;
    const tagFilters = filters.tags ?? [];

    return list.filter((recipe) => {
      if (mealType && recipe.meal_type !== mealType) {
        return false;
      }
      if (category && recipe.category !== category) {
        return false;
      }
      if (tagFilters.length > 0) {
        const recipeTags = new Set(recipe.tags ?? []);
        if (!tagFilters.every((tag) => recipeTags.has(tag))) {
          return false;
        }
      }
      if (!search) {
        return true;
      }
      const inTitle = recipe.title.toLowerCase().includes(search);
      const inIngredients = (recipe.ingredients ?? []).some((ingredient) =>
        ingredient.name.toLowerCase().includes(search)
      );
      return inTitle || inIngredients;
    });
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
      .eq('is_base_recipe', false)
      .maybeSingle();

    if (error) {
      return { recipe: null, error: 'Could not load this recipe. Please try again.' };
    }

    if (!data) {
      return { recipe: null, error: 'Recipe not found.' };
    }

    return { recipe: this.normalizeRecipe(data), error: null };
  }

  async getBaseRecipeById(
    id: string
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.getBaseRecipeByIdLocal(id);
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { recipe: null, error: 'Could not load this starter recipe.' };
    }

    const { data, error } = await client
      .from('recipes')
      .select(RECIPE_SELECT)
      .eq('id', id)
      .eq('is_base_recipe', true)
      .maybeSingle();

    if (error) {
      return { recipe: null, error: 'Could not load this starter recipe. Please try again.' };
    }

    if (!data) {
      return { recipe: null, error: 'Starter recipe not found.' };
    }

    return { recipe: this.normalizeRecipe(data), error: null };
  }

  async createRecipeFromTemplate(
    baseRecipeId: string
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.createRecipeFromTemplateLocal(baseRecipeId);
    }

    const { recipe: baseRecipe, error: baseError } = await this.getBaseRecipeById(baseRecipeId);
    if (baseError || !baseRecipe) {
      return { recipe: null, error: baseError ?? 'Starter recipe not found.' };
    }

    const ingredients: RecipeIngredientInput[] = (baseRecipe.ingredients ?? []).map(
      (ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })
    );

    return this.createRecipe(
      {
        title: baseRecipe.title,
        description: baseRecipe.description,
        prep_time_minutes: baseRecipe.prep_time_minutes,
        cook_time_minutes: baseRecipe.cook_time_minutes,
        portions: baseRecipe.portions,
        tags: baseRecipe.tags,
        base_recipe_id: baseRecipe.id,
        meal_type: baseRecipe.meal_type,
        category: baseRecipe.category,
        difficulty: baseRecipe.difficulty,
        instructions: baseRecipe.instructions,
      },
      ingredients,
      { triggerImageGeneration: !this.hasImageMetadata(baseRecipe) }
    ).then(async (result) => {
      if (!result.recipe) {
        return result;
      }

      if (this.hasImageMetadata(baseRecipe)) {
        const { error } = await this.updateRecipeImageMetadata(result.recipe.id, {
          image_url: baseRecipe.image_url,
          image_status: baseRecipe.image_status,
          image_prompt: baseRecipe.image_prompt ?? null,
          image_provider: baseRecipe.image_provider ?? null,
          image_version: baseRecipe.image_version ?? 1,
          image_generated_at: baseRecipe.image_generated_at ?? null,
          image_error: baseRecipe.image_error ?? null,
          image_storage_provider: baseRecipe.image_storage_provider ?? null,
          image_storage_key: baseRecipe.image_storage_key ?? null,
        });

        if (error) {
          return { recipe: result.recipe, error: null };
        }

        const { recipe } = await this.getRecipeById(result.recipe.id);
        return { recipe: recipe ?? result.recipe, error: null };
      }

      return result;
    });
  }

  getRecipeImageUrl(recipe: Recipe): string | null {
    return this.recipeImageUrlService.getRecipeImageUrl(recipe);
  }

  async updateRecipeImageMetadata(
    recipeId: string,
    metadata: RecipeImageMetadataUpdate
  ): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.updateRecipeImageMetadataLocal(recipeId, metadata);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in to update recipe images.' };
    }

    const row = this.toImageMetadataRow(metadata);
    const { error } = await client
      .from('recipes')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', recipeId)
      .eq('user_id', userId)
      .eq('is_base_recipe', false);

    if (error) {
      return { error: 'Could not update recipe image metadata. Please try again.' };
    }

    await this.loadRecipes();
    return { error: null };
  }

  async markRecipeImageAsFailed(
    recipeId: string,
    errorMessage: string
  ): Promise<{ error: string | null }> {
    return this.updateRecipeImageMetadata(recipeId, {
      image_status: 'failed',
      image_error: errorMessage.trim() || 'Image generation failed.',
    });
  }

  async requestRecipeImageGeneration(recipeId: string): Promise<{ error: string | null }> {
    return this.requestRecipeImageGenerationWithStatus(recipeId);
  }

  async regenerateRecipeImage(recipeId: string): Promise<{ error: string | null }> {
    return this.requestRecipeImageGenerationWithStatus(recipeId, { regenerate: true });
  }

  private hasImageMetadata(recipe: Recipe): boolean {
    return (
      recipe.image_status === 'completed' ||
      Boolean(recipe.image_url?.trim()) ||
      Boolean(recipe.image_storage_key?.trim())
    );
  }

  private toImageMetadataRow(metadata: RecipeImageMetadataUpdate): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (metadata.image_url !== undefined) {
      row['image_url'] = metadata.image_url?.trim() || null;
    }
    if (metadata.image_status !== undefined) {
      row['image_status'] = metadata.image_status;
    }
    if (metadata.image_prompt !== undefined) {
      row['image_prompt'] = metadata.image_prompt;
    }
    if (metadata.image_provider !== undefined) {
      row['image_provider'] = metadata.image_provider;
    }
    if (metadata.image_version !== undefined) {
      row['image_version'] = metadata.image_version;
    }
    if (metadata.image_generated_at !== undefined) {
      row['image_generated_at'] = metadata.image_generated_at;
    }
    if (metadata.image_error !== undefined) {
      row['image_error'] = metadata.image_error;
    }
    if (metadata.image_storage_provider !== undefined) {
      row['image_storage_provider'] = metadata.image_storage_provider;
    }
    if (metadata.image_storage_key !== undefined) {
      row['image_storage_key'] = metadata.image_storage_key;
    }

    return row;
  }

  private async updateRecipeImageMetadataLocal(
    recipeId: string,
    metadata: RecipeImageMetadataUpdate
  ): Promise<{ error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { error: 'Local API is not available.' };
    }

    try {
      await this.localApiService.updateRecipeImageMetadata(recipeId, metadata);
      await this.loadRecipes();
      return { error: null };
    } catch {
      return { error: 'Could not update recipe image metadata. Please try again.' };
    }
  }

  private triggerRecipeImageGeneration(recipeId: string): void {
    if (environment.useLocalApi) {
      return;
    }

    void this.runRecipeImageGeneration(recipeId);
  }

  async requestRecipeImageGenerationWithStatus(
    recipeId: string,
    options?: { regenerate?: boolean }
  ): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return { error: 'Recipe image generation is not available in local mode.' };
    }

    return this.runRecipeImageGeneration(recipeId, options?.regenerate ?? false);
  }

  private async runRecipeImageGeneration(
    recipeId: string,
    regenerate = false
  ): Promise<{ error: string | null }> {
    this.applyGeneratingToSignal(recipeId);

    const { error: statusError } = await this.updateRecipeImageMetadata(recipeId, {
      image_status: 'generating',
      image_error: null,
    });

    if (statusError) {
      return { error: statusError };
    }

    const { error } = regenerate
      ? await this.recipeImageService.regenerateRecipeImage(recipeId)
      : await this.recipeImageService.requestRecipeImageGeneration(recipeId);

    if (error) {
      const { recipe } = await this.getRecipeById(recipeId);
      const dbError = recipe?.image_error?.trim();
      const apiError = error.trim();

      if (apiError) {
        if (
          !dbError ||
          dbError.includes('non-2xx') ||
          dbError === apiError
        ) {
          if (recipe?.image_status !== 'failed' || recipe.image_error !== apiError) {
            await this.markRecipeImageAsFailed(recipeId, apiError);
          }
          await this.loadRecipes();
          return { error: apiError };
        }
      }

      if (recipe?.image_status === 'failed' && dbError) {
        await this.loadRecipes();
        return { error: dbError };
      }

      await this.markRecipeImageAsFailed(recipeId, apiError || 'Could not generate recipe image.');
      return { error: apiError || 'Could not generate recipe image.' };
    }

    await this.loadRecipes();
    return { error: null };
  }

  private applyGeneratingToSignal(recipeId: string): void {
    this.recipesSignal.update((recipes) =>
      recipes.map((recipe) =>
        recipe.id === recipeId ? { ...recipe, image_status: 'generating' as const } : recipe
      )
    );
  }

  async createRecipe(
    recipeData: RecipeInput,
    ingredients: RecipeIngredientInput[],
    options?: { triggerImageGeneration?: boolean }
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
      .insert({
        ...this.toRecipeRow(recipeData),
        user_id: userId,
        is_base_recipe: false,
      })
      .select('*')
      .single();

    if (createError || !created) {
      const message = 'Could not save this recipe. Please try again.';
      this.errorSignal.set(message);
      return { recipe: null, error: message };
    }

    const recipeId = (created as Recipe).id;
    const cleanedIngredients = this.cleanIngredients(ingredients);
    const insertError = await this.replaceIngredients(recipeId, ingredients);
    if (insertError) {
      return { recipe: null, error: insertError };
    }

    if (cleanedIngredients.length > 0) {
      await this.calculateAndSaveNutrition(recipeId, recipeData, cleanedIngredients);
    }

    await this.loadRecipes();
    const { recipe } = await this.getRecipeById(recipeId);

    if (recipe && options?.triggerImageGeneration !== false) {
      this.triggerRecipeImageGeneration(recipeId);
      return {
        recipe: { ...recipe, image_status: 'generating' },
        error: null,
      };
    }

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

    const existing = this.recipesSignal().find((recipe) => recipe.id === id);
    if (existing?.is_base_recipe) {
      return { recipe: null, error: 'Starter recipes cannot be edited directly.' };
    }

    this.errorSignal.set(null);

    const { error: updateError } = await client
      .from('recipes')
      .update({ ...this.toRecipeRow(recipeData), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_base_recipe', false);

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

    const existing = this.recipesSignal().find((recipe) => recipe.id === id);
    if (existing?.is_base_recipe) {
      return { error: 'Starter recipes cannot be deleted.' };
    }

    this.errorSignal.set(null);

    const { error } = await client
      .from('recipes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_base_recipe', false);

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
      .eq('user_id', userId)
      .eq('is_base_recipe', false);

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

  private async loadBaseRecipesLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.baseLoadingSignal.set(true);
    this.baseErrorSignal.set(null);

    try {
      const data = await this.localApiService.getBaseRecipes();
      this.baseRecipesSignal.set(this.normalizeRecipes(data));
    } catch {
      this.baseErrorSignal.set('Could not load starter recipes. Please try again.');
    } finally {
      this.baseLoadingSignal.set(false);
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

  private async getBaseRecipeByIdLocal(
    id: string
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { recipe: null, error: 'Could not load this starter recipe.' };
    }

    try {
      const data = await this.localApiService.getBaseRecipe(id);
      return { recipe: this.normalizeRecipe(data), error: null };
    } catch {
      return { recipe: null, error: 'Starter recipe not found.' };
    }
  }

  private async createRecipeFromTemplateLocal(
    baseRecipeId: string
  ): Promise<{ recipe: Recipe | null; error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { recipe: null, error: 'You must be signed in to customize recipes.' };
    }

    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.createRecipeFromTemplate(baseRecipeId);
      const recipe = this.normalizeRecipe(data);
      await this.loadRecipes();
      return { recipe, error: null };
    } catch {
      const message = 'Could not create your recipe from this template. Please try again.';
      this.errorSignal.set(message);
      return { recipe: null, error: message };
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
      cook_time_minutes: recipeData.cook_time_minutes ?? null,
      portions: recipeData.portions ?? null,
      tags: normalizeTags(recipeData.tags ?? []),
      base_recipe_id: recipeData.base_recipe_id ?? null,
      meal_type: recipeData.meal_type ?? null,
      category: recipeData.category?.trim() || null,
      difficulty: recipeData.difficulty ?? null,
      instructions: (recipeData.instructions ?? [])
        .map((step) => step.trim())
        .filter((step) => step.length > 0),
    };
  }

  private normalizeRecipes(data: unknown): Recipe[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((row) => this.normalizeRecipe(row));
  }

  private normalizeRecipe(row: unknown): Recipe {
    const recipe = row as Recipe & {
      is_base_recipe?: unknown;
      nutrition_calories?: unknown;
      nutrition_fat_g?: unknown;
      nutrition_cholesterol_mg?: unknown;
      nutrition_protein_g?: unknown;
      nutrition_sugar_g?: unknown;
      nutrition_sodium_mg?: unknown;
      nutrition_carbs_g?: unknown;
      nutrition_fiber_g?: unknown;
      nutrition_calculated_at?: unknown;
      instructions?: unknown;
    };

    return {
      id: recipe.id,
      user_id: recipe.user_id ?? null,
      title: recipe.title,
      description: recipe.description,
      prep_time_minutes: recipe.prep_time_minutes,
      cook_time_minutes: recipe.cook_time_minutes ?? null,
      portions: recipe.portions,
      tags: normalizeTags(recipe.tags ?? []),
      rating: this.normalizeRating(recipe.rating),
      image_url: recipe.image_url?.trim() || null,
      image_status: this.normalizeImageStatus(recipe.image_status),
      image_prompt: recipe.image_prompt ?? null,
      image_provider: recipe.image_provider ?? null,
      image_version: this.toIntOrDefault(recipe.image_version, 1),
      image_generated_at: recipe.image_generated_at ?? null,
      image_error: recipe.image_error ?? null,
      image_storage_provider: recipe.image_storage_provider ?? null,
      image_storage_key: recipe.image_storage_key?.trim() || null,
      is_base_recipe: recipe.is_base_recipe === true || Number(recipe.is_base_recipe) === 1,
      base_recipe_id: recipe.base_recipe_id ?? null,
      meal_type: recipe.meal_type ?? null,
      category: recipe.category ?? null,
      difficulty: recipe.difficulty ?? null,
      instructions: this.normalizeInstructions(recipe.instructions),
      nutrition: this.normalizeNutritionFromRow(recipe),
      created_at: recipe.created_at,
      updated_at: recipe.updated_at,
      ingredients: [...(recipe.ingredients ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    };
  }

  private normalizeInstructions(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((step) => String(step).trim()).filter((step) => step.length > 0);
  }

  private normalizeNutritionFromRow(row: {
    nutrition_calories?: unknown;
    nutrition_fat_g?: unknown;
    nutrition_cholesterol_mg?: unknown;
    nutrition_protein_g?: unknown;
    nutrition_sugar_g?: unknown;
    nutrition_sodium_mg?: unknown;
    nutrition_carbs_g?: unknown;
    nutrition_fiber_g?: unknown;
    nutrition_calculated_at?: unknown;
  }): RecipeNutrition | null {
    const calories = this.toNutritionNumber(row.nutrition_calories);
    const fat_g = this.toNutritionNumber(row.nutrition_fat_g);
    const cholesterol_mg = this.toNutritionNumber(row.nutrition_cholesterol_mg);
    const protein_g = this.toNutritionNumber(row.nutrition_protein_g);
    const sugar_g = this.toNutritionNumber(row.nutrition_sugar_g);
    const sodium_mg = this.toNutritionNumber(row.nutrition_sodium_mg);
    const carbs_g = this.toNutritionNumber(row.nutrition_carbs_g);
    const fiber_g = this.toNutritionNumber(row.nutrition_fiber_g);
    const calculated_at =
      typeof row.nutrition_calculated_at === 'string' && row.nutrition_calculated_at.trim()
        ? row.nutrition_calculated_at.trim()
        : null;

    if (
      calories === null &&
      fat_g === null &&
      cholesterol_mg === null &&
      protein_g === null &&
      sugar_g === null &&
      sodium_mg === null &&
      carbs_g === null &&
      fiber_g === null
    ) {
      return null;
    }

    return {
      calories,
      fat_g,
      cholesterol_mg,
      protein_g,
      sugar_g,
      sodium_mg,
      carbs_g,
      fiber_g,
      calculated_at,
    };
  }

  private toNutritionNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      return null;
    }
    return Math.round(num * 10) / 10;
  }

  async recalculateNutrition(recipeId: string): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return { error: 'Nutrition estimation is not available in local mode.' };
    }

    const { recipe, error: loadError } = await this.getRecipeById(recipeId);
    if (loadError || !recipe) {
      return { error: loadError ?? 'Recipe not found.' };
    }

    const ingredients = (recipe.ingredients ?? []).map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    }));

    if (ingredients.length === 0) {
      return { error: 'Add at least one ingredient to estimate nutrition.' };
    }

    return this.calculateAndSaveNutrition(
      recipeId,
      {
        title: recipe.title,
        description: recipe.description,
        portions: recipe.portions,
      },
      ingredients
    );
  }

  private async calculateAndSaveNutrition(
    recipeId: string,
    recipeData: Pick<RecipeInput, 'title' | 'description' | 'portions'>,
    ingredients: { name: string; quantity: number | null; unit: string | null }[]
  ): Promise<{ error: string | null }> {
    const { nutrition, error } = await this.recipeNutritionService.estimateNutrition({
      title: recipeData.title,
      description: recipeData.description,
      portions: recipeData.portions,
      ingredients,
    });

    if (error) {
      return { error };
    }

    if (nutrition) {
      await this.saveRecipeNutrition(recipeId, nutrition);
      return { error: null };
    }

    return { error: 'Could not estimate nutrition right now.' };
  }

  private async saveRecipeNutrition(
    recipeId: string,
    nutrition: RecipeNutrition
  ): Promise<void> {
    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;
    if (!client || !userId) {
      return;
    }

    await client
      .from('recipes')
      .update({
        nutrition_calories: nutrition.calories,
        nutrition_fat_g: nutrition.fat_g,
        nutrition_cholesterol_mg: nutrition.cholesterol_mg,
        nutrition_protein_g: nutrition.protein_g,
        nutrition_sugar_g: nutrition.sugar_g,
        nutrition_sodium_mg: nutrition.sodium_mg,
        nutrition_carbs_g: nutrition.carbs_g,
        nutrition_fiber_g: nutrition.fiber_g,
        nutrition_calculated_at: nutrition.calculated_at,
      })
      .eq('id', recipeId)
      .eq('user_id', userId);
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

  private normalizeImageStatus(value: unknown): RecipeImageStatus {
    if (
      value === 'pending' ||
      value === 'generating' ||
      value === 'completed' ||
      value === 'failed'
    ) {
      return value;
    }

    return 'pending';
  }

  private toIntOrDefault(value: unknown, fallback: number): number {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    const num = Number(value);
    return Number.isInteger(num) && num > 0 ? num : fallback;
  }
}
