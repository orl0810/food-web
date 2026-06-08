import { Component, WritableSignal, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AiRecipeSuggestion,
} from '../../core/models/ai-recipe-suggestion.model';
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  MealType,
} from '../../core/models/meal-plan.model';
import {
  Recipe,
  RecipeIngredientInput,
} from '../../core/models/recipe.model';
import {
  SmartSuggestion,
  SuggestionFilters,
} from '../../core/models/smart-suggestion.model';
import { AiRecipeService } from '../../core/services/ai-recipe.service';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { RecipeService } from '../../core/services/recipe.service';
import { ShoppingListService } from '../../core/services/shopping-list.service';
import { SmartSuggestionService } from '../../core/services/smart-suggestion.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { normalizeIngredientName } from '../../shared/utils/ingredient-matching.utils';
import { AddToMealPlanDialogComponent } from './add-to-meal-plan-dialog.component';
import { SuggestionCardComponent } from './suggestion-card.component';

interface SuggestionSection {
  title: string;
  emptyMessage: string;
  items: SmartSuggestion[];
}

const SECTION_LIMIT = 6;
const PREP_TIME_OPTIONS = [15, 30, 45];
const AI_PREP_TIME_OPTIONS = [15, 30, 45, 60];
const TAG_OPTIONS = ['quick', 'cheap', 'healthy', 'meal-prep'];
const AI_ERROR_MESSAGE = 'Could not generate recipes right now. Please try again.';

@Component({
  selector: 'app-suggestions',
  standalone: true,
  imports: [
    EmptyStateComponent,
    LoadingStateComponent,
    SuggestionCardComponent,
    AddToMealPlanDialogComponent,
  ],
  template: `
    <div class="page">
      <div>
        <h1 class="page-title">Smart Suggestions</h1>
        <p class="page-subtitle">
          Find what to cook based on your inventory, expiring foods, and recipes.
        </p>
      </div>

      @if (loading()) {
        <app-loading-state message="Finding suggestions..." />
      } @else if (error()) {
        <p class="alert-error">{{ error() }}</p>
      } @else {
        <section class="card space-y-5 p-4">
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-stone-500">
              AI recipe ideas
            </p>
            <h2 class="mt-1 text-lg font-semibold text-stone-900">
              Generate easy recipes from your inventory
            </h2>
            <p class="mt-1 text-sm text-stone-600">
              PantryFlow sends your selected preferences to a secure Supabase Edge Function. The function loads only your inventory items needed for recipe ideas.
            </p>
          </div>

          @if (inventoryService.items().length === 0) {
            <p class="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Add some ingredients to your inventory first.
            </p>
          } @else {
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label class="block text-sm font-medium text-stone-700">
                Meal type
                <select
                  class="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  [value]="aiMealType()"
                  (change)="setAiMealType($event)"
                >
                  @for (mealType of mealTypes; track mealType) {
                    <option [value]="mealType">{{ mealTypeLabel(mealType) }}</option>
                  }
                </select>
              </label>

              <label class="block text-sm font-medium text-stone-700">
                Max prep time
                <select
                  class="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  [value]="aiMaxPrepTime()"
                  (change)="setAiMaxPrepTime($event)"
                >
                  @for (option of aiPrepTimeOptions; track option) {
                    <option [value]="option">{{ option }} min</option>
                  }
                </select>
              </label>

              <label class="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  [checked]="aiPrioritizeExpiring()"
                  (change)="aiPrioritizeExpiring.set(!aiPrioritizeExpiring())"
                />
                Prioritize expiring ingredients
              </label>

              <label class="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700">
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
            <div class="grid gap-4 lg:grid-cols-3">
              @for (suggestion of aiSuggestions(); track suggestion.title) {
                <article class="flex flex-col rounded-xl border border-brand-100 bg-card p-4 shadow-sm">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-base font-semibold text-stone-900">
                        {{ suggestion.title }}
                      </h3>
                      <p class="mt-1 text-sm text-stone-600">{{ suggestion.description }}</p>
                    </div>
                    <span class="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800">
                      {{ suggestion.prepTimeMinutes }} min
                    </span>
                  </div>

                  <div class="mt-3 flex flex-wrap gap-1.5">
                    <span class="rounded-md bg-cream px-2 py-0.5 text-xs font-medium text-stone-700">
                      {{ suggestion.portions }} portions
                    </span>
                    <span class="rounded-md bg-cream px-2 py-0.5 text-xs font-medium text-stone-700">
                      easy
                    </span>
                    @for (tag of suggestion.tags; track tag) {
                      <span class="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
                        {{ tag }}
                      </span>
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
                            <span class="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
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
                            <span class="rounded-md bg-sage/10 px-2 py-0.5 text-xs font-medium text-sage-dark">
                              {{ ingredient }}
                            </span>
                          }
                        </div>
                      </div>
                    }

                    <p class="rounded-lg bg-cream p-3 text-stone-600">
                      {{ suggestion.reason }}
                    </p>

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
                      [disabled]="suggestion.missingIngredients.length === 0 || isAddingAiMissingItems(suggestion)"
                      (click)="addAiMissingIngredientsToShoppingList(suggestion)"
                    >
                      {{ isAddingAiMissingItems(suggestion) ? 'Adding...' : 'Add Missing Ingredients to Shopping List' }}
                    </button>
                  </div>
                </article>
              }
            </div>
          }
        </section>

        @if (recipeService.recipes().length === 0) {
          <app-empty-state
            title="No saved recipes yet"
            description="Use AI suggestions above or add a few recipes manually so PantryFlow can show rule-based suggestions."
            actionLabel="Add a recipe"
            (actionClick)="goToRecipes()"
          />
        } @else {
          <!-- Filters -->
          <div class="card space-y-4 p-4">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-stone-500">
                Max prep time
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="filter-pill"
                  [class.filter-pill-active]="maxPrepTime() === null"
                  [class.filter-pill-inactive]="maxPrepTime() !== null"
                  (click)="maxPrepTime.set(null)"
                >
                  Any
                </button>
                @for (option of prepTimeOptions; track option) {
                  <button
                    type="button"
                    class="filter-pill"
                    [class.filter-pill-active]="maxPrepTime() === option"
                    [class.filter-pill-inactive]="maxPrepTime() !== option"
                    (click)="maxPrepTime.set(option)"
                  >
                    {{ option }} min
                  </button>
                }
              </div>
            </div>

            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-stone-500">Tags</p>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (tag of tagOptions; track tag) {
                  <button
                    type="button"
                    class="filter-pill"
                    [class.filter-pill-active]="activeTags().includes(tag)"
                    [class.filter-pill-inactive]="!activeTags().includes(tag)"
                    (click)="toggleTag(tag)"
                  >
                    {{ tag }}
                  </button>
                }
              </div>
            </div>

            <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-700">
              <label class="inline-flex items-center gap-2">
                <input type="checkbox" [checked]="prioritizeExpiring()" (change)="prioritizeExpiring.set(!prioritizeExpiring())" />
                Prioritize expiring foods
              </label>
              <label class="inline-flex items-center gap-2">
                <input type="checkbox" [checked]="hidePlanned()" (change)="hidePlanned.set(!hidePlanned())" />
                Hide recipes planned this week
              </label>
              <label class="inline-flex items-center gap-2">
                <input type="checkbox" [checked]="onlyCookNow()" (change)="onlyCookNow.set(!onlyCookNow())" />
                Only show recipes I can cook now
              </label>
            </div>
          </div>

          @if (inventoryService.items().length === 0) {
            <p class="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Your inventory is empty. Add what you have at home to get better suggestions.
            </p>
          }

          @if (infoMessage()) {
            <p class="alert-info">{{ infoMessage() }}</p>
          }

          @if (base().length === 0) {
            <app-empty-state
              title="No suggestions found"
              description="No suggestions match the current filters. Try relaxing the filters."
            />
          } @else {
            @for (section of sections(); track section.title) {
              <section class="space-y-3">
                <h2 class="section-title">{{ section.title }}</h2>
                @if (section.items.length === 0) {
                  <p class="text-sm text-stone-500">{{ section.emptyMessage }}</p>
                } @else {
                  <div class="grid gap-4 sm:grid-cols-2">
                    @for (suggestion of section.items; track suggestion.recipe.id) {
                      <app-suggestion-card
                        [suggestion]="suggestion"
                        (addToPlan)="openDialog($event)"
                      />
                    }
                  </div>
                }
              </section>
            }
          }
        }
      }
    </div>

    @if (dialogRecipe()) {
      <app-add-to-meal-plan-dialog
        [recipe]="dialogRecipe()!"
        (saved)="onSaved()"
        (cancelled)="dialogRecipe.set(null)"
      />
    }
  `,
})
export class SuggestionsComponent implements OnInit {
  readonly suggestionService = inject(SmartSuggestionService);
  readonly recipeService = inject(RecipeService);
  readonly inventoryService = inject(FoodInventoryService);
  readonly aiRecipeService = inject(AiRecipeService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly router = inject(Router);

  readonly prepTimeOptions = PREP_TIME_OPTIONS;
  readonly aiPrepTimeOptions = AI_PREP_TIME_OPTIONS;
  readonly tagOptions = TAG_OPTIONS;
  readonly mealTypes = MEAL_TYPES;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);
  readonly aiInfoMessage = signal<string | null>(null);
  readonly aiError = signal<string | null>(null);
  readonly dialogRecipe = signal<Recipe | null>(null);

  readonly aiMealType = signal<MealType>('dinner');
  readonly aiMaxPrepTime = signal(30);
  readonly aiPrioritizeExpiring = signal(true);
  readonly aiIncludeMissing = signal(false);
  readonly aiSuggestions = signal<AiRecipeSuggestion[]>([]);
  readonly savedAiRecipes = signal<Record<string, Recipe>>({});
  readonly savingAiRecipeKeys = signal<string[]>([]);
  readonly planningAiRecipeKeys = signal<string[]>([]);
  readonly addingAiMissingKeys = signal<string[]>([]);

  readonly maxPrepTime = signal<number | null>(null);
  readonly activeTags = signal<string[]>([]);
  readonly prioritizeExpiring = signal(false);
  readonly hidePlanned = signal(false);
  readonly onlyCookNow = signal(false);

  readonly base = computed(() => {
    const filters: SuggestionFilters = {
      maxPrepTime: this.maxPrepTime() ?? undefined,
      includeAlreadyPlanned: this.hidePlanned() ? false : undefined,
      onlyUseAvailableIngredients: this.onlyCookNow(),
      prioritizeExpiringSoon: this.prioritizeExpiring(),
      tags: this.activeTags().length > 0 ? this.activeTags() : undefined,
    };
    return this.suggestionService.getSmartSuggestions(filters);
  });

  readonly sections = computed<SuggestionSection[]>(() => {
    const base = this.base();

    const expiring = base.filter(
      (suggestion) => suggestion.expiringIngredientsUsed.length > 0
    );
    const available = base.filter(
      (suggestion) =>
        (suggestion.recipe.ingredients?.length ?? 0) > 0 &&
        suggestion.matchPercentage >= 50
    );
    const quick = base.filter((suggestion) => {
      const prep = suggestion.recipe.prep_time_minutes;
      return (
        (suggestion.recipe.tags ?? []).includes('quick') ||
        (prep !== null && prep <= 30)
      );
    });
    const mealPrep = base.filter((suggestion) =>
      (suggestion.recipe.tags ?? []).includes('meal-prep')
    );
    const lowMissing = base.filter(
      (suggestion) =>
        (suggestion.recipe.ingredients?.length ?? 0) > 0 &&
        suggestion.missingIngredients.length <= 2
    );

    return [
      {
        title: 'Use Expiring Soon',
        emptyMessage: 'Nothing is expiring soon. Great job keeping your food fresh.',
        items: expiring.slice(0, SECTION_LIMIT),
      },
      {
        title: 'Cook With What You Have',
        emptyMessage: 'No recipes match your current inventory yet.',
        items: available.slice(0, SECTION_LIMIT),
      },
      {
        title: 'Quick Meals',
        emptyMessage: 'No quick recipes match the current filters.',
        items: quick.slice(0, SECTION_LIMIT),
      },
      {
        title: 'Meal Prep Ideas',
        emptyMessage: 'No meal-prep recipes yet. Tag a recipe "meal-prep" to see it here.',
        items: mealPrep.slice(0, SECTION_LIMIT),
      },
      {
        title: 'Few Missing Ingredients',
        emptyMessage: 'No recipes with two or fewer missing ingredients right now.',
        items: lowMissing.slice(0, SECTION_LIMIT),
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.suggestionService.refresh();
    } catch {
      this.error.set('Could not load suggestions. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleTag(tag: string): void {
    const current = this.activeTags();
    this.activeTags.set(
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag]
    );
  }

  setAiMealType(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as MealType;
    this.aiMealType.set(value);
  }

  setAiMaxPrepTime(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.aiMaxPrepTime.set(value);
  }

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  ingredientLabel(ingredient: { name: string; quantity: number | null; unit: string | null }): string {
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

    const response = await this.aiRecipeService.generateRecipesFromInventory({
      mealType: this.aiMealType(),
      maxPrepTimeMinutes: this.aiMaxPrepTime(),
      prioritizeExpiringIngredients: this.aiPrioritizeExpiring(),
      includeMissingIngredients: this.aiIncludeMissing(),
      numberOfSuggestions: 3,
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

  async addAiMissingIngredientsToShoppingList(
    suggestion: AiRecipeSuggestion
  ): Promise<void> {
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

  openDialog(suggestion: SmartSuggestion): void {
    this.infoMessage.set(null);
    this.dialogRecipe.set(suggestion.recipe);
  }

  async onSaved(): Promise<void> {
    const title = this.dialogRecipe()?.title;
    this.dialogRecipe.set(null);
    this.infoMessage.set(
      title ? `${title} added to your meal plan.` : 'Added to your meal plan.'
    );
    await this.suggestionService.loadPlannedRecipeIds();
  }

  goToRecipes(): void {
    void this.router.navigateByUrl('/recipes/new');
  }

  private toRecipeIngredients(
    suggestion: AiRecipeSuggestion
  ): RecipeIngredientInput[] {
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
