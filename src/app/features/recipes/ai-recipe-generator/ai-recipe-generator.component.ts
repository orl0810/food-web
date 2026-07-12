import { Component, inject, input, signal, WritableSignal } from '@angular/core';
import {
  AiRecipeFocusMode,
  AiRecipeSuggestion,
} from '../../../core/models/ai-recipe-suggestion.model';
import { MEAL_TYPE_LABELS, MEAL_TYPES, MealType } from '../../../core/models/meal-plan.model';
import { Recipe, RecipeIngredientInput } from '../../../core/models/recipe.model';
import { AiRecipeService } from '../../../core/services/ai-recipe.service';
import { FoodInventoryService } from '../../../core/services/food-inventory.service';
import { RecipeImageService } from '../../../core/services/recipe-image.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { ShoppingListService } from '../../../core/services/shopping-list.service';
import { FormatTagPipe } from '../../../shared/pipes/format-tag.pipe';
import { buildAiOnboardingContextFromProfile } from '../../../shared/utils/ai-recipe-context.utils';
import { normalizeIngredientName } from '../../../shared/utils/ingredient-matching.utils';
import { UserProfileFacadeService } from '../../user-profile/services/user-profile-facade.service';
import { AddToMealPlanDialogComponent } from '../recipe-suggestions/add-to-meal-plan-dialog.component';

const AI_PREP_TIME_OPTIONS = [15, 30, 45, 60];
const AI_ERROR_MESSAGE = 'Could not generate recipes right now. Please try again.';

const FOCUS_MODE_OPTIONS: { value: AiRecipeFocusMode; label: string }[] = [
  { value: 'pantry', label: 'Use my pantry' },
  { value: 'shopping', label: 'Open to shopping' },
  { value: 'inspire', label: 'Inspire me' },
];

const FOCUS_MODE_HELP: Record<AiRecipeFocusMode, string> = {
  pantry: 'Uses what you already have. Only basic staples may be added.',
  shopping: 'Prefers your pantry and expiring items, but allows a few missing ingredients.',
  inspire: 'Describe what you want — inventory is optional.',
};

@Component({
  selector: 'app-ai-recipe-generator',
  standalone: true,
  imports: [FormatTagPipe, AddToMealPlanDialogComponent],
  template: `
    <div class="space-y-5">
      @if (!embedded()) {
        <div class="flex items-start gap-3">
          <span class="ai-sparkle" aria-hidden="true">✨</span>
          <div>
            <h2 class="text-base font-semibold text-stone-900">AI recipe ideas</h2>
            <p class="mt-0.5 text-sm text-stone-600">
              Generate realistic recipes tailored to your pantry or your mood
            </p>
          </div>
        </div>
      }

      @if (requiresInventory() && inventoryService.items().length === 0) {
        <p
          class="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600"
        >
          Add some ingredients to your inventory first, or switch to Inspire me mode.
        </p>
      } @else {
        <fieldset class="space-y-2">
          <legend class="text-sm font-medium text-stone-700">Recipe focus</legend>
          <div class="flex flex-wrap gap-2">
            @for (option of focusModeOptions; track option.value) {
              <button
                type="button"
                class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
                [class.border-sage-600]="aiFocusMode() === option.value"
                [class.bg-sage-50]="aiFocusMode() === option.value"
                [class.text-sage-800]="aiFocusMode() === option.value"
                [class.border-stone-300]="aiFocusMode() !== option.value"
                [class.bg-white]="aiFocusMode() !== option.value"
                [class.text-stone-700]="aiFocusMode() !== option.value"
                (click)="setFocusMode(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>
          <p class="text-xs text-stone-500">{{ focusModeHelp() }}</p>
        </fieldset>

        <div class="grid gap-4 md:grid-cols-2">
          <label class="block text-sm font-medium text-stone-700">
            Meal type
            <select class="input mt-1.5" [value]="aiMealType()" (change)="setAiMealType($event)">
              @for (mealType of mealTypes; track mealType) {
                <option [value]="mealType">{{ mealTypeLabel(mealType) }}</option>
              }
            </select>
          </label>

          <label class="block text-sm font-medium text-stone-700">
            Max prep time
            <select class="input mt-1.5" [value]="aiMaxPrepTime()" (change)="setAiMaxPrepTime($event)">
              @for (option of aiPrepTimeOptions; track option) {
                <option [value]="option">{{ option }} min</option>
              }
            </select>
          </label>
        </div>

        <label class="block text-sm font-medium text-stone-700">
          Personal touch
          @if (aiFocusMode() === 'inspire') {
            <span class="font-normal text-stone-500"> (required)</span>
          } @else {
            <span class="font-normal text-stone-500"> (optional)</span>
          }
          <input
            type="text"
            class="input mt-1.5"
            placeholder='e.g. vegetarian, something cold, easy, Colombian style'
            [value]="aiCustomPrompt()"
            (input)="onCustomPromptInput($event)"
          />
        </label>
      }

      @if (aiError()) {
        <p class="alert-error">{{ aiError() }}</p>
      }

      @if (aiInfoMessage()) {
        <p class="alert-info">{{ aiInfoMessage() }}</p>
      }

      @if (aiSuggestions().length > 0) {
        <div class="grid gap-4 lg:grid-cols-2">
          @for (suggestion of aiSuggestions(); track suggestion.title) {
            <article class="card flex flex-col overflow-hidden p-0">
              <div class="relative aspect-[4/3] w-full bg-stone-100">
                @if (suggestion.previewImageUrl) {
                  <img
                    [src]="suggestion.previewImageUrl"
                    [alt]="suggestion.title"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                } @else if (suggestion.previewImageStatus === 'loading') {
                  <div class="flex h-full items-center justify-center">
                    <div class="h-8 w-8 animate-pulse rounded-full bg-stone-300"></div>
                    <span class="sr-only">Generating preview image</span>
                  </div>
                } @else {
                  <div class="flex h-full items-center justify-center text-sm text-stone-400">
                    Preview image unavailable
                  </div>
                }
              </div>

              <div class="flex flex-1 flex-col p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h3 class="text-base font-semibold text-stone-900">{{ suggestion.title }}</h3>
                    <p class="mt-1 text-sm text-stone-600">{{ suggestion.description }}</p>
                  </div>
                  <span class="tag shrink-0">{{ suggestion.prepTimeMinutes }} min</span>
                </div>

                <div class="mt-3 flex flex-wrap gap-1.5">
                  <span class="tag">{{ suggestion.portions }} portions</span>
                  <span class="tag">easy</span>
                  @for (tag of suggestion.tags; track tag) {
                    <span class="tag">{{ tag | formatTag }}</span>
                  }
                </div>

                <div class="mt-4 space-y-3 text-sm">
                  <div>
                    <p class="font-medium text-stone-800">Ingredients</p>
                    <ul class="mt-1 list-disc space-y-0.5 pl-5 text-stone-600">
                      @for (ingredient of suggestion.ingredients; track ingredient.name) {
                        <li>{{ ingredientLabel(ingredient) }}</li>
                      }
                    </ul>
                  </div>

                  @if (suggestion.missingIngredients.length > 0) {
                    <div>
                      <p class="font-medium text-stone-800">Missing ingredients</p>
                      <div class="mt-1 flex flex-wrap gap-1.5">
                        @for (ingredient of suggestion.missingIngredients; track ingredient.name) {
                          <span
                            class="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
                          >
                            {{ ingredientLabel(ingredient) }}
                          </span>
                        }
                      </div>
                    </div>
                  }

                  @if (suggestion.usedInventoryIngredients.length > 0) {
                    <div>
                      <p class="font-medium text-stone-800">Uses from inventory</p>
                      <div class="mt-1 flex flex-wrap gap-1.5">
                        @for (ingredient of suggestion.usedInventoryIngredients; track ingredient) {
                          <span class="tag">{{ ingredient }}</span>
                        }
                      </div>
                    </div>
                  }

                  <p class="rounded-lg bg-cream p-3 text-stone-600">{{ suggestion.reason }}</p>

                  <details class="rounded-lg border border-stone-200 p-3">
                    <summary class="cursor-pointer font-medium text-stone-800">Steps</summary>
                    <ol class="mt-2 list-decimal space-y-1 pl-5 text-stone-600">
                      @for (step of suggestion.steps; track step) {
                        <li>{{ step }}</li>
                      }
                    </ol>
                  </details>
                </div>

                <div class="mt-4 grid gap-2">
                  <button
                    type="button"
                    class="btn-primary"
                    [disabled]="isAiRecipeSaved(suggestion) || isSavingAiRecipe(suggestion)"
                    (click)="saveAiSuggestion(suggestion)"
                  >
                    @if (isAiRecipeSaved(suggestion)) {
                      Saved to recipes
                    } @else {
                      {{ isSavingAiRecipe(suggestion) ? 'Saving...' : 'Save to Recipes' }}
                    }
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    [disabled]="isPlanningAiRecipe(suggestion)"
                    (click)="openAiMealPlanDialog(suggestion)"
                  >
                    {{ isPlanningAiRecipe(suggestion) ? 'Preparing...' : 'Add to Meal Plan' }}
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    [disabled]="
                      suggestion.missingIngredients.length === 0 || isAddingAiMissingItems(suggestion)
                    "
                    (click)="addAiMissingIngredientsToShoppingList(suggestion)"
                  >
                    {{
                      isAddingAiMissingItems(suggestion)
                        ? 'Adding...'
                        : 'Add Missing Ingredients to Shopping List'
                    }}
                  </button>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>

    @if (dialogRecipe()) {
      <app-add-to-meal-plan-dialog
        [recipe]="dialogRecipe()!"
        (saved)="onMealPlanSaved()"
        (cancelled)="dialogRecipe.set(null)"
      />
    }
  `,
})
export class AiRecipeGeneratorComponent {
  readonly embedded = input(false);

  readonly aiRecipeService = inject(AiRecipeService);
  readonly inventoryService = inject(FoodInventoryService);
  private readonly recipeService = inject(RecipeService);
  private readonly recipeImageService = inject(RecipeImageService);
  private readonly profileFacade = inject(UserProfileFacadeService);
  private readonly shoppingListService = inject(ShoppingListService);

  readonly aiPrepTimeOptions = AI_PREP_TIME_OPTIONS;
  readonly mealTypes = MEAL_TYPES;
  readonly focusModeOptions = FOCUS_MODE_OPTIONS;

  readonly aiFocusMode = signal<AiRecipeFocusMode>('pantry');
  readonly aiMealType = signal<MealType>('dinner');
  readonly aiMaxPrepTime = signal(30);
  readonly aiCustomPrompt = signal('');
  readonly aiSuggestions = signal<AiRecipeSuggestion[]>([]);
  readonly aiError = signal<string | null>(null);
  readonly aiInfoMessage = signal<string | null>(null);
  readonly dialogRecipe = signal<Recipe | null>(null);
  readonly savedAiRecipes = signal<Record<string, Recipe>>({});
  readonly savingAiRecipeKeys = signal<string[]>([]);
  readonly planningAiRecipeKeys = signal<string[]>([]);
  readonly addingAiMissingKeys = signal<string[]>([]);

  focusModeHelp(): string {
    return FOCUS_MODE_HELP[this.aiFocusMode()];
  }

  requiresInventory(): boolean {
    return this.aiFocusMode() !== 'inspire';
  }

  canGenerate(): boolean {
    if (this.aiRecipeService.loading()) {
      return false;
    }

    if (this.aiFocusMode() === 'inspire') {
      return this.aiCustomPrompt().trim().length > 0;
    }

    return this.inventoryService.items().length > 0;
  }

  setFocusMode(mode: AiRecipeFocusMode): void {
    this.aiFocusMode.set(mode);
  }

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  setAiMealType(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as MealType;
    this.aiMealType.set(value);
  }

  setAiMaxPrepTime(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.aiMaxPrepTime.set(value);
  }

  onCustomPromptInput(event: Event): void {
    this.aiCustomPrompt.set((event.target as HTMLInputElement).value);
  }

  ingredientLabel(ingredient: {
    name: string;
    quantity: number | null;
    unit: string | null;
  }): string {
    const amount = ingredient.quantity === null ? '' : `${ingredient.quantity} `;
    const unit = ingredient.unit ? `${ingredient.unit} ` : '';
    return `${amount}${unit}${ingredient.name}`.trim();
  }

  async generateAiRecipes(): Promise<void> {
    this.aiError.set(null);
    this.aiInfoMessage.set(null);

    if (!this.canGenerate()) {
      this.aiSuggestions.set([]);
      if (this.aiFocusMode() === 'inspire') {
        this.aiError.set('Describe what kind of recipe you want in the personal touch field.');
      } else {
        this.aiError.set('Add some ingredients to your inventory first.');
      }
      return;
    }

    const focusFlags = this.focusModeFlags();
    const onboardingContext = buildAiOnboardingContextFromProfile(
      this.profileFacade.getProfileForSuggestions()
    );
    const excludeTitles =
      this.aiSuggestions().length > 0
        ? this.aiSuggestions().map((suggestion) => suggestion.title)
        : undefined;
    const customPrompt = this.aiCustomPrompt().trim();

    const response = await this.aiRecipeService.generateRecipesFromInventory({
      mealType: this.aiMealType(),
      maxPrepTimeMinutes: this.aiMaxPrepTime(),
      prioritizeExpiringIngredients: focusFlags.prioritizeExpiringIngredients,
      includeMissingIngredients: focusFlags.includeMissingIngredients,
      numberOfSuggestions: 2,
      ...(onboardingContext ? { onboardingContext } : {}),
      ...(excludeTitles?.length ? { excludeTitles } : {}),
      ...(customPrompt ? { customPrompt } : {}),
    });

    if (this.aiRecipeService.error()) {
      this.aiSuggestions.set([]);
      this.aiError.set(AI_ERROR_MESSAGE);
      return;
    }

    const suggestions = response.suggestions.map((suggestion) => ({
      ...suggestion,
      previewImageUrl: null,
      previewImageStatus: 'loading' as const,
    }));

    this.aiSuggestions.set(suggestions);
    if (suggestions.length === 0) {
      this.aiError.set(AI_ERROR_MESSAGE);
      return;
    }

    void this.loadPreviewImages(suggestions);
  }

  async saveAiSuggestion(suggestion: AiRecipeSuggestion): Promise<Recipe | null> {
    const key = this.aiSuggestionKey(suggestion);
    const saved = this.savedAiRecipes()[key];
    if (saved) {
      return saved;
    }
    if (this.isSavingAiRecipe(suggestion)) {
      return null;
    }

    this.addBusyKey(this.savingAiRecipeKeys, key);
    this.aiError.set(null);
    this.aiInfoMessage.set(null);

    const previewImageUrl = suggestion.previewImageUrl?.trim() || null;
    const hasPreviewImage = Boolean(previewImageUrl);

    const result = await this.recipeService.createRecipe(
      {
        title: suggestion.title,
        description: suggestion.description,
        prep_time_minutes: suggestion.prepTimeMinutes,
        portions: suggestion.portions,
        tags: suggestion.tags,
        instructions: suggestion.steps,
        meal_type: this.aiMealType(),
      },
      this.toRecipeIngredients(suggestion),
      { triggerImageGeneration: !hasPreviewImage }
    );

    if (result.error || !result.recipe) {
      this.removeBusyKey(this.savingAiRecipeKeys, key);
      this.aiError.set(result.error ?? 'Could not save this recipe. Please try again.');
      return null;
    }

    if (hasPreviewImage) {
      const imageResult = await this.recipeService.updateRecipeImageMetadata(result.recipe.id, {
        image_url: previewImageUrl,
        image_status: 'completed',
        image_provider: 'openai_gpt_image',
        image_storage_provider: 'supabase_storage',
      });

      if (imageResult.error) {
        this.removeBusyKey(this.savingAiRecipeKeys, key);
        this.aiError.set(imageResult.error);
        return null;
      }
    }

    this.removeBusyKey(this.savingAiRecipeKeys, key);

    const savedRecipe = this.recipeService
      .recipes()
      .find((recipe) => recipe.id === result.recipe?.id) ?? result.recipe;

    this.savedAiRecipes.update((recipes) => ({
      ...recipes,
      [key]: savedRecipe as Recipe,
    }));
    this.aiInfoMessage.set(`${savedRecipe.title} saved to your recipes.`);
    return savedRecipe as Recipe;
  }

  async openAiMealPlanDialog(suggestion: AiRecipeSuggestion): Promise<void> {
    const key = this.aiSuggestionKey(suggestion);
    const saved = this.savedAiRecipes()[key];
    if (saved) {
      this.dialogRecipe.set(saved);
      return;
    }

    this.addBusyKey(this.planningAiRecipeKeys, key);
    const recipe = await this.saveAiSuggestion(suggestion);
    this.removeBusyKey(this.planningAiRecipeKeys, key);

    if (recipe) {
      this.dialogRecipe.set(recipe);
    }
  }

  async addAiMissingIngredientsToShoppingList(suggestion: AiRecipeSuggestion): Promise<void> {
    const key = this.aiSuggestionKey(suggestion);
    if (suggestion.missingIngredients.length === 0 || this.isAddingAiMissingItems(suggestion)) {
      return;
    }

    this.addBusyKey(this.addingAiMissingKeys, key);
    this.aiError.set(null);
    this.aiInfoMessage.set(null);

    await this.shoppingListService.getShoppingItems();
    const existingNames = new Set(
      this.shoppingListService
        .items()
        .filter((item) => !item.is_checked)
        .map((item) => normalizeIngredientName(item.name))
    );

    let addedCount = 0;
    for (const ingredient of suggestion.missingIngredients) {
      const normalizedName = normalizeIngredientName(ingredient.name);
      if (!normalizedName || existingNames.has(normalizedName)) {
        continue;
      }

      const result = await this.shoppingListService.addShoppingItem({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        source: 'manual',
      });
      if (result.error) {
        this.removeBusyKey(this.addingAiMissingKeys, key);
        this.aiError.set(result.error);
        return;
      }

      existingNames.add(normalizedName);
      addedCount += 1;
    }

    this.removeBusyKey(this.addingAiMissingKeys, key);
    this.aiInfoMessage.set(
      addedCount === 0
        ? 'Those missing ingredients are already on your shopping list.'
        : `${addedCount} missing ${addedCount === 1 ? 'ingredient' : 'ingredients'} added to your shopping list.`
    );
  }

  onMealPlanSaved(): void {
    const title = this.dialogRecipe()?.title;
    this.dialogRecipe.set(null);
    this.aiInfoMessage.set(
      title ? `${title} added to your meal plan.` : 'Added to your meal plan.'
    );
  }

  isAiRecipeSaved(suggestion: AiRecipeSuggestion): boolean {
    return Boolean(this.savedAiRecipes()[this.aiSuggestionKey(suggestion)]);
  }

  isSavingAiRecipe(suggestion: AiRecipeSuggestion): boolean {
    return this.savingAiRecipeKeys().includes(this.aiSuggestionKey(suggestion));
  }

  isPlanningAiRecipe(suggestion: AiRecipeSuggestion): boolean {
    return this.planningAiRecipeKeys().includes(this.aiSuggestionKey(suggestion));
  }

  isAddingAiMissingItems(suggestion: AiRecipeSuggestion): boolean {
    return this.addingAiMissingKeys().includes(this.aiSuggestionKey(suggestion));
  }

  private focusModeFlags(): {
    prioritizeExpiringIngredients: boolean;
    includeMissingIngredients: boolean;
  } {
    switch (this.aiFocusMode()) {
      case 'shopping':
        return { prioritizeExpiringIngredients: true, includeMissingIngredients: true };
      case 'inspire':
        return { prioritizeExpiringIngredients: false, includeMissingIngredients: true };
      case 'pantry':
      default:
        return { prioritizeExpiringIngredients: true, includeMissingIngredients: false };
    }
  }

  private async loadPreviewImages(suggestions: AiRecipeSuggestion[]): Promise<void> {
    await Promise.all(
      suggestions.map(async (suggestion, index) => {
        const result = await this.recipeImageService.requestSuggestionPreviewImage({
          title: suggestion.title,
          mealType: this.aiMealType(),
          tags: suggestion.tags,
          ingredients: suggestion.ingredients.map((ingredient) => ingredient.name),
        });

        this.aiSuggestions.update((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  previewImageUrl: result.previewImageUrl,
                  previewImageStatus: result.previewImageUrl ? 'completed' : 'failed',
                }
              : item
          )
        );
      })
    );
  }

  private toRecipeIngredients(suggestion: AiRecipeSuggestion): RecipeIngredientInput[] {
    return suggestion.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    }));
  }

  private aiSuggestionKey(suggestion: AiRecipeSuggestion): string {
    return suggestion.title.trim().toLowerCase();
  }

  private addBusyKey(target: WritableSignal<string[]>, key: string): void {
    target.update((keys) => (keys.includes(key) ? keys : [...keys, key]));
  }

  private removeBusyKey(target: WritableSignal<string[]>, key: string): void {
    target.update((keys) => keys.filter((value) => value !== key));
  }
}
