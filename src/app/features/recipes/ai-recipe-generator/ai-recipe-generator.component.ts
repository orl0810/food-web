import { Component, inject, input, signal, WritableSignal } from '@angular/core';
import { AiRecipeSuggestion } from '../../../core/models/ai-recipe-suggestion.model';
import { MEAL_TYPE_LABELS, MEAL_TYPES, MealType } from '../../../core/models/meal-plan.model';
import { Recipe, RecipeIngredientInput } from '../../../core/models/recipe.model';
import { AiRecipeService } from '../../../core/services/ai-recipe.service';
import { FoodInventoryService } from '../../../core/services/food-inventory.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { ShoppingListService } from '../../../core/services/shopping-list.service';
import { FormatTagPipe } from '../../../shared/pipes/format-tag.pipe';
import { buildAiOnboardingContextFromProfile } from '../../../shared/utils/ai-recipe-context.utils';
import { normalizeIngredientName } from '../../../shared/utils/ingredient-matching.utils';
import { UserProfileFacadeService } from '../../user-profile/services/user-profile-facade.service';
import { AddToMealPlanDialogComponent } from '../recipe-suggestions/add-to-meal-plan-dialog.component';

const AI_PREP_TIME_OPTIONS = [15, 30, 45, 60];
const AI_ERROR_MESSAGE = 'Could not generate recipes right now. Please try again.';

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
              Generate easy recipes from your inventory with AI
            </p>
          </div>
        </div>
      }

      <p class="text-sm text-stone-600">
        PantryFlow sends your selected preferences to a secure Supabase Edge Function. The function
        loads only your inventory items needed for recipe ideas.
      </p>

      @if (inventoryService.items().length === 0) {
        <p
          class="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600"
        >
          Add some ingredients to your inventory first.
        </p>
      } @else {
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

          <label class="inline-flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              [checked]="aiPrioritizeExpiring()"
              (change)="aiPrioritizeExpiring.set(!aiPrioritizeExpiring())"
            />
            Prioritize expiring ingredients
          </label>

          <label class="inline-flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              [checked]="aiIncludeMissing()"
              (change)="aiIncludeMissing.set(!aiIncludeMissing())"
            />
            Include missing ingredients
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="btn-primary"
            [disabled]="aiRecipeService.loading()"
            (click)="generateAiRecipes()"
          >
            {{ aiRecipeService.loading() ? 'Generating...' : 'Generate suggestions' }}
          </button>
          @if (aiRecipeService.loading()) {
            <span class="text-sm text-stone-600">
              Generating easy recipes from your ingredients...
            </span>
          }
        </div>
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
            <article class="card flex flex-col p-4">
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
  private readonly profileFacade = inject(UserProfileFacadeService);
  private readonly shoppingListService = inject(ShoppingListService);

  readonly aiPrepTimeOptions = AI_PREP_TIME_OPTIONS;
  readonly mealTypes = MEAL_TYPES;

  readonly aiMealType = signal<MealType>('dinner');
  readonly aiMaxPrepTime = signal(30);
  readonly aiPrioritizeExpiring = signal(true);
  readonly aiIncludeMissing = signal(false);
  readonly aiSuggestions = signal<AiRecipeSuggestion[]>([]);
  readonly aiError = signal<string | null>(null);
  readonly aiInfoMessage = signal<string | null>(null);
  readonly dialogRecipe = signal<Recipe | null>(null);
  readonly savedAiRecipes = signal<Record<string, Recipe>>({});
  readonly savingAiRecipeKeys = signal<string[]>([]);
  readonly planningAiRecipeKeys = signal<string[]>([]);
  readonly addingAiMissingKeys = signal<string[]>([]);

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

    if (this.inventoryService.items().length === 0) {
      this.aiSuggestions.set([]);
      this.aiError.set('Add some ingredients to your inventory first.');
      return;
    }

    const onboardingContext = buildAiOnboardingContextFromProfile(
      this.profileFacade.getProfileForSuggestions()
    );
    const excludeTitles =
      this.aiSuggestions().length > 0
        ? this.aiSuggestions().map((suggestion) => suggestion.title)
        : undefined;

    const response = await this.aiRecipeService.generateRecipesFromInventory({
      mealType: this.aiMealType(),
      maxPrepTimeMinutes: this.aiMaxPrepTime(),
      prioritizeExpiringIngredients: this.aiPrioritizeExpiring(),
      includeMissingIngredients: this.aiIncludeMissing(),
      numberOfSuggestions: 3,
      ...(onboardingContext ? { onboardingContext } : {}),
      ...(excludeTitles?.length ? { excludeTitles } : {}),
    });

    if (this.aiRecipeService.error()) {
      this.aiSuggestions.set([]);
      this.aiError.set(AI_ERROR_MESSAGE);
      return;
    }

    this.aiSuggestions.set(response.suggestions);
    if (response.suggestions.length === 0) {
      this.aiError.set(AI_ERROR_MESSAGE);
    }
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

    const result = await this.recipeService.createRecipe(
      {
        title: suggestion.title,
        description: suggestion.description,
        prep_time_minutes: suggestion.prepTimeMinutes,
        portions: suggestion.portions,
        tags: suggestion.tags,
      },
      this.toRecipeIngredients(suggestion)
    );

    this.removeBusyKey(this.savingAiRecipeKeys, key);

    if (result.error || !result.recipe) {
      this.aiError.set(result.error ?? 'Could not save this recipe. Please try again.');
      return null;
    }

    this.savedAiRecipes.update((recipes) => ({
      ...recipes,
      [key]: result.recipe as Recipe,
    }));
    this.aiInfoMessage.set(`${result.recipe.title} saved to your recipes.`);
    return result.recipe;
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
