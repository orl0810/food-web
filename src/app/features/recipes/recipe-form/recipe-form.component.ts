import { Component, computed, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FoodCatalogItem } from '../../../core/models/food-catalog-item.model';
import { FoodItemHistory } from '../../../core/models/food-item-history.model';
import {
  FOOD_UNIT_LABELS,
  FOOD_UNIT_OTHER,
  FOOD_UNITS,
} from '../../../core/models/food-item.model';
import {
  Recipe,
  RecipeDifficulty,
  RecipeIngredientInput,
  RecipeInput,
  RECIPE_CATEGORIES,
} from '../../../core/models/recipe.model';
import { RecipeVoiceDraft } from '../../../core/models/voice-recipe.model';
import { RecipePhotoDraft } from '../../../core/models/photo-food-capture.model';
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType } from '../../../core/models/meal-plan.model';
import { SearchSelectOption } from '../../../core/models/search-select-option.model';
import { FoodCatalogService } from '../../../core/services/food-catalog.service';
import { FoodIconService } from '../../../core/services/food-icon.service';
import { FoodItemHistoryService } from '../../../core/services/food-item-history.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { EntitlementService } from '../../../core/services/entitlement.service';
import { FoodLogPhotoService } from '../../../core/services/food-log-photo.service';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { FoodIconBadgeComponent } from '../../../shared/components/food-icon-badge/food-icon-badge.component';
import { RecipeImageComponent } from '../../../shared/components/recipe-image/recipe-image.component';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select.component';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating.component';
import { FormatTagPipe } from '../../../shared/pipes/format-tag.pipe';
import {
  resolveStoredUnit,
  resolveUnitFormFields,
} from '../../../shared/utils/food-unit.utils';
import { normalizeNameKey } from '../../../shared/utils/name-normalization.utils';
import { normalizeTag } from '../../../shared/utils/tag.utils';
import { environment } from '../../../../environments/environment';

interface RecipeFormSnapshot {
  title: string;
  description: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  portions: number | null;
  meal_type: MealType | '';
  category: string;
  difficulty: RecipeDifficulty | '';
  tags: string[];
  rating: number | null;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  instructions: string[];
}

@Component({
  selector: 'app-recipe-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LoadingStateComponent,
    FoodIconBadgeComponent,
    RecipeImageComponent,
    SearchSelectComponent,
    StarRatingComponent,
    FormatTagPipe,
    TitleCasePipe,
  ],
  template: `
    @if (loading()) {
      <app-loading-state message="Loading recipe..." />
    } @else {
      <form [class]="embedded() ? 'space-y-4' : 'page'" [formGroup]="form" (ngSubmit)="submit()">
        @if (!embedded()) {
          <div class="flex items-center justify-between gap-4">
            <h1 class="page-title">
              {{ isEdit() ? 'Edit recipe' : 'New recipe' }}
            </h1>
            @if (!isEdit()) {
              <a
                [routerLink]="cancelLink()"
                class="text-sm text-stone-500 hover:text-stone-700"
              >
                Cancel
              </a>
            }
          </div>
        }

        @if (!embedded()) {
          <section class="card overflow-hidden p-0">
            <div class="relative aspect-[16/10] w-full">
              @if (isEdit() && loadedRecipe(); as recipe) {
                <app-recipe-image [recipe]="recipe" variant="hero" class="h-full" />
              } @else if (photoPreviewUrl()) {
                <img
                  [src]="photoPreviewUrl()!"
                  alt="Recipe photo preview"
                  class="h-full w-full object-cover"
                />
                <button
                  type="button"
                  class="absolute top-3 right-3 rounded-full bg-white/90 p-2 text-stone-700 shadow-sm backdrop-blur-sm hover:bg-white"
                  aria-label="Remove photo"
                  (click)="removePhoto()"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              } @else {
                <app-recipe-image [recipe]="createPlaceholderRecipe()" variant="hero" class="h-full" />
              }

              @if (isEdit() && loadedRecipe() && showRegenerateButton()) {
                <button
                  type="button"
                  class="absolute top-3 right-3 rounded-full bg-white/90 p-2 text-stone-700 shadow-sm backdrop-blur-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  [attr.aria-label]="generatingImage() ? 'Generating image' : 'Regenerate image'"
                  [disabled]="generatingImage() || loadedRecipe()!.image_status === 'generating'"
                  (click)="generateRecipeImage()"
                >
                  @if (generatingImage() || loadedRecipe()!.image_status === 'generating') {
                    <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" aria-hidden="true"></span>
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  }
                </button>
              }

              <div class="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 backdrop-blur-sm [&_button.text-stone-300]:text-white/50">
                <span class="text-xs font-medium text-white/90">Rate</span>
                <app-star-rating
                  [rating]="rating()"
                  size="sm"
                  (ratingChange)="onRatingChange($event)"
                />
              </div>
            </div>
          </section>

          @if (imageError()) {
            <p class="text-sm text-red-600" role="alert">{{ imageError() }}</p>
          }
          @if (ratingError()) {
            <p class="text-sm text-red-600" role="alert">{{ ratingError() }}</p>
          }
        }

        @if (photoPreviewUrl() && embedded()) {
          <section class="card overflow-hidden p-0">
            <div class="relative">
              <img
                [src]="photoPreviewUrl()!"
                alt="Recipe photo preview"
                class="h-48 w-full object-cover"
              />
              @if (!isEdit()) {
                <button
                  type="button"
                  class="absolute top-2 right-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-stone-700 shadow-sm hover:bg-white"
                  (click)="removePhoto()"
                >
                  Remove photo
                </button>
              }
            </div>
          </section>
        }

        @if (photoWarning()) {
          <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
            {{ photoWarning() }}
          </p>
        }

        <section class="card space-y-4 p-5">
          <div>
            <label for="title" class="mb-1 block text-sm font-medium text-stone-700">Title *</label>
            <input
              id="title"
              type="text"
              formControlName="title"
              class="input"
              placeholder="e.g. Tomato pasta"
            />
          </div>

          <div>
            <label for="description" class="mb-1 block text-sm font-medium text-stone-700">Description</label>
            <textarea
              id="description"
              rows="3"
              formControlName="description"
              class="input"
              placeholder="A short note about this recipe..."
            ></textarea>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="prep_time_minutes" class="mb-1 block text-sm font-medium text-stone-700">
                Prep time (minutes)
              </label>
              <input
                id="prep_time_minutes"
                type="number"
                min="0"
                step="1"
                formControlName="prep_time_minutes"
                class="input"
              />
            </div>
            <!-- Cook time hidden for now; form control kept to preserve existing values on edit -->
            <div>
              <label for="portions" class="mb-1 block text-sm font-medium text-stone-700">Portions</label>
              <input
                id="portions"
                type="number"
                min="0"
                step="1"
                formControlName="portions"
                class="input"
              />
            </div>
            <div>
              <label for="meal_type" class="mb-1 block text-sm font-medium text-stone-700">Meal type</label>
              <select id="meal_type" formControlName="meal_type" class="input">
                <option value="">—</option>
                @for (mealType of mealTypes; track mealType) {
                  <option [value]="mealType">{{ mealTypeLabels[mealType] }}</option>
                }
              </select>
            </div>
            <div>
              <label for="category" class="mb-1 block text-sm font-medium text-stone-700">Category</label>
              <select id="category" formControlName="category" class="input">
                <option value="">—</option>
                @for (category of recipeCategories; track category) {
                  <option [value]="category">{{ category }}</option>
                }
              </select>
            </div>
            <div>
              <label for="difficulty" class="mb-1 block text-sm font-medium text-stone-700">Difficulty</label>
              <select id="difficulty" formControlName="difficulty" class="input">
                <option value="">—</option>
                @for (level of difficultyLevels; track level) {
                  <option [value]="level">{{ level | titlecase }}</option>
                }
              </select>
            </div>
          </div>
        </section>

        <section class="card space-y-3 p-5">
          <div class="flex items-center justify-between gap-3">
            <h2 class="section-title">Instructions</h2>
            <button type="button" class="btn-secondary-sm" (click)="addInstructionStep()">
              Add step
            </button>
          </div>
          @if (instructions.length === 0) {
            <p class="text-sm text-stone-500">No steps yet. Add simple cooking instructions.</p>
          } @else {
            <div class="space-y-3" formArrayName="instructions">
              @for (step of instructions.controls; track step; let i = $index) {
                <div class="flex gap-2" [formGroupName]="i">
                  <span class="mt-2.5 shrink-0 text-sm font-medium text-stone-500">{{ i + 1 }}.</span>
                  <textarea
                    rows="2"
                    formControlName="text"
                    class="input flex-1"
                    placeholder="Describe this step..."
                  ></textarea>
                  <button
                    type="button"
                    class="shrink-0 self-start rounded-lg border border-stone-300 px-2 py-1 text-sm text-stone-600 hover:bg-stone-50"
                    aria-label="Remove step"
                    (click)="removeInstructionStep(i)"
                  >
                    &times;
                  </button>
                </div>
              }
            </div>
          }
        </section>

        <section class="card space-y-3 p-5">
          <h2 class="section-title">Tags</h2>
          @if (tags().length > 0) {
            <div class="flex flex-wrap gap-2">
              @for (tag of tags(); track tag) {
                <span class="tag flex items-center gap-1.5 px-2.5 py-1">
                  {{ tag | formatTag }}
                  <button
                    type="button"
                    class="text-brand-500 hover:text-brand-700"
                    aria-label="Remove tag"
                    (click)="removeTag(tag)"
                  >
                    &times;
                  </button>
                </span>
              }
            </div>
          }
          <div class="flex gap-2">
            <input
              #tagInput
              type="text"
              placeholder="e.g. quick, cheap, healthy"
              class="input flex-1"
              (keydown.enter)="addTag(tagInput.value); tagInput.value = ''; $event.preventDefault()"
            />
            <button
              type="button"
              class="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              (click)="addTag(tagInput.value); tagInput.value = ''"
            >
              Add tag
            </button>
          </div>
        </section>

        <section class="card-featured overflow-hidden">
          <div class="flex items-center justify-between gap-4 border-b border-stone-200/70 px-4 py-4 sm:px-5">
            <h2 class="section-title">Ingredients</h2>
            @if (ingredients.length > 0) {
              <span class="text-sm text-stone-500">{{ ingredients.length }} added</span>
            }
          </div>

          @if (ingredients.length === 0) {
            <p class="px-4 py-6 text-sm text-stone-600 sm:px-5">No ingredients added yet.</p>
          } @else {
            <div class="divide-y divide-stone-200/70 overflow-x-auto" formArrayName="ingredients">
              @for (ingredient of ingredients.controls; track ingredient; let i = $index) {
                @if (editingIndex() === i) {
                  <div class="space-y-3 px-4 py-4 sm:px-5" [formGroupName]="i">
                    <div class="grid gap-2 sm:grid-cols-12">
                      <div class="sm:col-span-6">
                        <app-search-select
                          [inputId]="'ingredient-name-' + i"
                          [control]="nameControlAt(i)"
                          [options]="ingredientOptions()"
                          placeholder="Name *"
                          (selected)="applyIngredientSelection(i, $event)"
                        />
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        formControlName="quantity"
                        placeholder="Qty"
                        class="input bg-white sm:col-span-2"
                      />
                      <div class="sm:col-span-3">
                        <select formControlName="unit" class="input bg-white">
                          <option value="">—</option>
                          @for (foodUnit of foodUnits; track foodUnit) {
                            <option [value]="foodUnit">{{ unitLabels[foodUnit] }}</option>
                          }
                          <option [value]="unitOther">Other...</option>
                        </select>
                        @if (ingredient.get('unit')?.value === unitOther) {
                          <input
                            type="text"
                            formControlName="unit_custom"
                            class="input mt-2 bg-white"
                            placeholder="can, bottle, cup"
                          />
                        }
                      </div>
                      <button
                        type="button"
                        class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:col-span-1"
                        aria-label="Done editing ingredient"
                        (click)="finishEdit(i)"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                } @else {
                  <article
                    class="flex w-max min-w-full cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-white/50 sm:gap-5 sm:px-5"
                    (click)="startEdit(i)"
                  >
                    <app-food-icon-badge
                      [name]="ingredientLabel(i)"
                      [category]="ingredientCategory(i)"
                    />

                    <p class="shrink-0 text-sm font-semibold text-stone-900">
                      {{ ingredientLabel(i) }}
                    </p>

                    @if (ingredientQuantityLabel(i)) {
                      <p class="shrink-0 text-sm whitespace-nowrap">
                        <span class="text-stone-500">Quantity: </span>
                        <span class="font-medium text-stone-800">{{ ingredientQuantityLabel(i) }}</span>
                      </p>
                    }

                    <button
                      type="button"
                      class="ml-auto shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 transition-colors hover:bg-red-50 hover:text-red-700"
                      aria-label="Remove ingredient"
                      (click)="removeIngredient(i); $event.stopPropagation()"
                    >
                      Remove
                    </button>
                  </article>
                }
              }
            </div>
          }

          @if (showAddForm()) {
            <div class="space-y-3 border-t border-stone-200/70 px-4 py-4 sm:px-5" [formGroup]="draftForm">
              <p class="text-sm font-medium text-stone-700">Add ingredient</p>
              <div class="grid gap-2 sm:grid-cols-12">
                <div class="sm:col-span-6">
                  <app-search-select
                    inputId="ingredient-draft-name"
                    [control]="draftNameControl"
                    [options]="ingredientOptions()"
                    placeholder="Name *"
                    (selected)="applyDraftSelection($event)"
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  formControlName="quantity"
                  placeholder="Qty"
                  class="input bg-white sm:col-span-2"
                />
                <div class="sm:col-span-4">
                  <select formControlName="unit" class="input bg-white">
                    <option value="">—</option>
                    @for (foodUnit of foodUnits; track foodUnit) {
                      <option [value]="foodUnit">{{ unitLabels[foodUnit] }}</option>
                    }
                    <option [value]="unitOther">Other...</option>
                  </select>
                  @if (draftForm.controls.unit.value === unitOther) {
                    <input
                      type="text"
                      formControlName="unit_custom"
                      class="input mt-2 bg-white"
                      placeholder="can, bottle, cup"
                    />
                  }
                </div>
              </div>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-500 hover:bg-stone-50"
                  (click)="cancelAddForm()"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  (click)="commitDraft()"
                >
                  Add
                </button>
              </div>
            </div>
          } @else {
            <div class="border-t border-stone-200/70 px-4 py-3 sm:px-5">
              <button
                type="button"
                class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-white/60 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400 hover:bg-white"
                (click)="openAddForm()"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="h-4 w-4"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add ingredient
              </button>
            </div>
          }
        </section>

        @if (error()) {
          <p class="alert-error">{{ error() }}</p>
        }

        @if (!embedded()) {
          <div class="flex flex-wrap justify-end gap-3">
            <a [routerLink]="cancelLink()" class="btn-secondary">
              Cancel
            </a>
            @if (isEdit()) {
              <button
                type="button"
                class="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                [disabled]="!hasChanges() || saving() || form.invalid"
                (click)="saveAsNewRecipe()"
              >
                {{ saving() ? 'Saving...' : 'Save as new recipe' }}
              </button>
            }
            <button
              type="submit"
              class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="form.invalid || saving()"
            >
              {{ saving() ? (isEdit() ? 'Saving...' : 'Calculating nutrition...') : isEdit() ? 'Save changes' : 'Create recipe' }}
            </button>
          </div>
        }
      </form>
    }
  `,
})
export class RecipeFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);
  private readonly entitlementService = inject(EntitlementService);
  private readonly photoService = inject(FoodLogPhotoService);
  private readonly foodItemHistoryService = inject(FoodItemHistoryService);
  private readonly foodCatalogService = inject(FoodCatalogService);
  private readonly foodIconService = inject(FoodIconService);

  readonly embedded = input(false);
  readonly titleId = input('recipe-form-title');
  readonly initialDraft = input<RecipeVoiceDraft | null>(null);
  readonly photoDraft = input<RecipePhotoDraft | null>(null);

  readonly saved = output<Recipe>();
  readonly cancelled = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly photoWarning = signal<string | null>(null);
  readonly photoPreviewUrl = signal<string | null>(null);
  readonly activePhotoFile = signal<File | null>(null);
  readonly tags = signal<string[]>([]);
  readonly editingIndex = signal<number | null>(null);
  readonly showAddForm = signal(false);
  readonly loadedRecipe = signal<Recipe | null>(null);
  readonly generatingImage = signal(false);
  readonly imageError = signal<string | null>(null);
  readonly ratingError = signal<string | null>(null);
  readonly rating = signal<number | null>(null);

  private readonly formChangeTrigger = signal(0);
  private originalSnapshot: RecipeFormSnapshot | null = null;
  private imagePollTimer: ReturnType<typeof setInterval> | null = null;
  private imagePollAttempts = 0;
  private readonly maxImagePollAttempts = 40;

  readonly foodUnits = FOOD_UNITS;
  readonly unitLabels = FOOD_UNIT_LABELS;
  readonly unitOther = FOOD_UNIT_OTHER;

  private recipeId: string | null = null;
  private baseRecipeId: string | null = null;

  readonly mealTypes = MEAL_TYPES;
  readonly mealTypeLabels = MEAL_TYPE_LABELS;
  readonly recipeCategories = RECIPE_CATEGORIES;
  readonly difficultyLevels: RecipeDifficulty[] = ['easy', 'medium', 'hard'];

  readonly ingredientOptions = computed<SearchSelectOption[]>(() => {
    this.foodItemHistoryService.history();
    this.foodCatalogService.catalogItems();

    const historyOptions = this.foodItemHistoryService.getHistoryOptions('').map((option) => ({
      ...option,
      icon: this.foodIconService.resolveIcon(
        option.label,
        this.isHistoryEntry(option.payload) ? option.payload.category : null
      ),
    }));
    const historyKeys = new Set(historyOptions.map((option) => normalizeNameKey(option.label)));
    const catalogOptions = this.foodCatalogService
      .getCatalogOptions('')
      .filter((option) => !historyKeys.has(normalizeNameKey(option.label)))
      .map((option) => ({
        ...option,
        icon: this.isCatalogItem(option.payload)
          ? option.payload.icon
          : this.foodIconService.resolveIcon(option.label),
      }));

    return [...historyOptions, ...catalogOptions];
  });

  readonly createPlaceholderRecipe = computed(() => {
    this.formChangeTrigger();
    const value = this.form.getRawValue();
    return {
      title: (value.title ?? '').trim() || 'New recipe',
      image_url: null,
      image_storage_key: null,
      image_status: 'pending' as const,
      meal_type: value.meal_type || null,
      category: value.category?.trim() || null,
    };
  });

  readonly hasChanges = computed(() => {
    this.formChangeTrigger();
    this.tags();
    this.rating();
    if (!this.isEdit() || this.loading() || !this.originalSnapshot) {
      return false;
    }
    return !this.snapshotsEqual(this.originalSnapshot, this.captureSnapshot());
  });

  readonly form = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    prep_time_minutes: [null as number | null],
    cook_time_minutes: [null as number | null],
    portions: [null as number | null],
    meal_type: ['' as MealType | ''],
    category: [''],
    difficulty: ['' as RecipeDifficulty | ''],
    ingredients: this.fb.array<FormGroup>([]),
    instructions: this.fb.array<FormGroup>([]),
  });

  readonly draftForm = this.fb.group({
    name: ['', Validators.required],
    quantity: [null as number | null],
    unit: [''],
    unit_custom: [''],
    category: [''],
  });

  readonly draftNameControl = this.draftForm.get('name') as FormControl<string | null>;

  constructor() {
    this.draftForm.controls.unit.valueChanges.subscribe((unit) => {
      this.syncUnitCustomValidators(this.draftForm.controls.unit_custom, unit);
    });
    this.form.valueChanges.subscribe(() => {
      this.formChangeTrigger.update((n) => n + 1);
    });
  }

  get ingredients(): FormArray<FormGroup> {
    return this.form.controls.ingredients;
  }

  get instructions(): FormArray<FormGroup> {
    return this.form.controls.instructions;
  }

  isEdit(): boolean {
    return this.recipeId !== null;
  }

  cancelLink(): unknown[] {
    return this.recipeId ? ['/recipes', this.recipeId] : ['/recipes'];
  }

  async ngOnInit(): Promise<void> {
    void this.foodItemHistoryService.loadAllHistory();
    void this.foodCatalogService.loadCatalog();

    this.recipeId = this.route.snapshot.paramMap.get('id');

    if (!this.recipeId) {
      const draft = this.initialDraft();
      if (draft) {
        this.applyVoiceDraft(draft);
      }
      const photo = this.photoDraft();
      if (photo) {
        this.applyPhotoDraft(photo);
      }
      return;
    }

    this.loading.set(true);
    const { recipe, error } = await this.recipeService.getVisibleRecipeById(this.recipeId);
    this.loading.set(false);

    if (error || !recipe) {
      this.error.set(error ?? 'Recipe not found.');
      return;
    }

    if (recipe.is_base_recipe) {
      const { recipe: copy, error: copyError } =
        await this.recipeService.ensurePersonalRecipeFromBase(recipe.id);
      if (copyError || !copy) {
        this.error.set(copyError ?? 'Could not create your recipe from this template.');
        return;
      }
      await this.router.navigate(['/recipes', copy.id, 'edit'], { replaceUrl: true });
      return;
    }

    this.form.patchValue({
      title: recipe.title,
      description: recipe.description ?? '',
      prep_time_minutes: recipe.prep_time_minutes,
      cook_time_minutes: recipe.cook_time_minutes,
      portions: recipe.portions,
      meal_type: recipe.meal_type ?? '',
      category: recipe.category ?? '',
      difficulty: recipe.difficulty ?? '',
    });
    this.tags.set([...recipe.tags]);
    this.baseRecipeId = recipe.base_recipe_id;

    const ingredients = recipe.ingredients ?? [];
    for (const ingredient of ingredients) {
      this.ingredients.push(
        this.buildIngredientGroup(ingredient.name, ingredient.quantity, ingredient.unit)
      );
    }

    for (const step of recipe.instructions ?? []) {
      this.instructions.push(this.buildInstructionGroup(step));
    }

    this.loadedRecipe.set(recipe);
    this.rating.set(recipe.rating);
    this.originalSnapshot = this.captureSnapshot();
    this.startImagePollingIfNeeded(recipe);
  }

  ngOnDestroy(): void {
    this.stopImagePolling();
  }

  showRegenerateButton(): boolean {
    return this.isEdit() && this.loadedRecipe() !== null;
  }

  async generateRecipeImage(): Promise<void> {
    const recipe = this.loadedRecipe();
    if (!recipe || this.generatingImage()) {
      return;
    }

    this.generatingImage.set(true);
    this.imageError.set(null);

    const regenerate = recipe.image_status === 'failed' || recipe.image_status === 'completed';
    const { error } = regenerate
      ? await this.recipeService.regenerateRecipeImage(recipe.id)
      : await this.recipeService.requestRecipeImageGeneration(recipe.id);

    this.generatingImage.set(false);

    if (error) {
      this.imageError.set(error);
      return;
    }

    const updated = { ...recipe, image_status: 'generating' as const };
    this.loadedRecipe.set(updated);
    this.startImagePollingIfNeeded(updated);
  }

  async onRatingChange(nextRating: number | null): Promise<void> {
    const previousRating = this.rating();
    this.ratingError.set(null);
    this.rating.set(nextRating);

    if (!this.isEdit() || !this.recipeId) {
      return;
    }

    const { error } = await this.recipeService.updateRecipeRating(this.recipeId, nextRating);
    if (error) {
      this.rating.set(previousRating);
      this.ratingError.set(error);
      return;
    }

    const current = this.loadedRecipe();
    if (current) {
      this.loadedRecipe.set({ ...current, rating: nextRating });
    }

    if (this.originalSnapshot) {
      this.originalSnapshot = { ...this.originalSnapshot, rating: nextRating };
    }
  }

  async saveAsNewRecipe(): Promise<void> {
    if (!this.isEdit() || !this.hasChanges() || this.form.invalid || this.saving()) {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
      }
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const { recipeData, ingredients } = this.buildRecipePayload(false);
    const result = await this.recipeService.createRecipe(recipeData, ingredients, {
      triggerImageGeneration: true,
    });

    if (result.error || !result.recipe) {
      this.saving.set(false);
      this.error.set(result.error ?? 'Could not save this recipe. Please try again.');
      return;
    }

    const currentRating = this.rating();
    if (currentRating !== null) {
      await this.recipeService.updateRecipeRating(result.recipe.id, currentRating);
    }

    this.saving.set(false);
    await this.router.navigate(['/recipes', result.recipe.id]);
  }

  nameControlAt(index: number): FormControl<string | null> {
    return this.ingredients.at(index).get('name') as FormControl<string | null>;
  }

  applyIngredientSelection(index: number, option: SearchSelectOption): void {
    this.applySelectionPayload(this.ingredients.at(index), option);
  }

  applyDraftSelection(option: SearchSelectOption): void {
    this.applySelectionPayload(this.draftForm, option);
  }

  ingredientLabel(index: number): string {
    return ((this.ingredients.at(index).get('name')?.value as string) ?? '').trim();
  }

  ingredientCategory(index: number): string | null {
    const group = this.ingredients.at(index);
    const fromForm = ((group.get('category')?.value as string) ?? '').trim();
    if (fromForm) {
      return fromForm;
    }

    const name = this.ingredientLabel(index);
    const entry = this.foodItemHistoryService
      .history()
      .find((h) => normalizeNameKey(h.name) === normalizeNameKey(name));
    return entry?.category?.trim() || null;
  }

  ingredientQuantityLabel(index: number): string | null {
    const group = this.ingredients.at(index);
    const quantity = this.toNumberOrNull(group.get('quantity')?.value as number | null);
    const unit =
      resolveStoredUnit(
        group.get('unit')?.value as string | null,
        group.get('unit_custom')?.value as string | null
      ) ?? '';

    if (quantity === null && !unit) {
      return null;
    }

    if (quantity === null) {
      return unit;
    }

    return unit ? `${quantity} ${unit}` : `${quantity}`;
  }

  startEdit(index: number): void {
    this.showAddForm.set(false);
    this.editingIndex.set(index);
  }

  openAddForm(): void {
    this.editingIndex.set(null);
    this.showAddForm.set(true);
  }

  cancelAddForm(): void {
    this.draftForm.reset({ name: '', quantity: null, unit: '', unit_custom: '', category: '' });
    this.showAddForm.set(false);
  }

  finishEdit(index: number): void {
    const group = this.ingredients.at(index);
    const name = ((group.get('name')?.value as string) ?? '').trim();
    if (!name) {
      group.get('name')?.markAsTouched();
      return;
    }
    if (group.invalid) {
      group.markAllAsTouched();
      return;
    }
    this.editingIndex.set(null);
  }

  commitDraft(): void {
    const name = ((this.draftForm.get('name')?.value as string) ?? '').trim();
    if (!name) {
      this.draftForm.get('name')?.markAsTouched();
      return;
    }
    if (this.draftForm.invalid) {
      this.draftForm.markAllAsTouched();
      return;
    }

    const quantity = this.toNumberOrNull(this.draftForm.get('quantity')?.value as number | null);
    const unit = resolveStoredUnit(
      this.draftForm.get('unit')?.value,
      this.draftForm.get('unit_custom')?.value
    );
    const category = ((this.draftForm.get('category')?.value as string) ?? '').trim() || null;

    this.ingredients.push(this.buildIngredientGroup(name, quantity, unit, category));
    this.draftForm.reset({ name: '', quantity: null, unit: '', unit_custom: '', category: '' });
    this.editingIndex.set(null);
    this.showAddForm.set(false);
  }

  removeIngredient(index: number): void {
    this.ingredients.removeAt(index);
    if (this.editingIndex() === index) {
      this.editingIndex.set(null);
    } else if (this.editingIndex() !== null && this.editingIndex()! > index) {
      this.editingIndex.update((current) => (current === null ? null : current - 1));
    }
  }

  addTag(value: string): void {
    const tag = normalizeTag(value);
    if (!tag) {
      return;
    }
    if (this.tags().includes(tag)) {
      return;
    }
    this.tags.update((tags) => [...tags, tag]);
  }

  removeTag(tag: string): void {
    this.tags.update((tags) => tags.filter((existing) => existing !== tag));
  }

  addInstructionStep(text = ''): void {
    this.instructions.push(this.buildInstructionGroup(text));
  }

  removeInstructionStep(index: number): void {
    this.instructions.removeAt(index);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.recipeId && !this.entitlementService.canCreatePersonalRecipe()) {
      this.error.set(
        'Free accounts can save up to 10 personal recipes. Upgrade to add more.'
      );
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const { recipeData, ingredients } = this.buildRecipePayload(true);

    const result = this.recipeId
      ? await this.recipeService.updateRecipe(this.recipeId, recipeData, ingredients)
      : await this.recipeService.createRecipe(recipeData, ingredients, {
          triggerImageGeneration: !this.activePhotoFile(),
        });

    if (result.error || !result.recipe) {
      this.saving.set(false);
      this.error.set(result.error ?? 'Could not save this recipe. Please try again.');
      return;
    }

    const photoFile = this.activePhotoFile();
    if (!this.recipeId && photoFile) {
      const uploadWarning = await this.attachPhotoToRecipe(result.recipe.id, photoFile);
      if (uploadWarning) {
        this.photoWarning.set(uploadWarning);
      }
    }

    if (!this.recipeId && this.rating() !== null) {
      await this.recipeService.updateRecipeRating(result.recipe.id, this.rating());
    }

    this.saving.set(false);

    if (this.embedded()) {
      this.saved.emit(result.recipe);
      return;
    }

    await this.router.navigate(['/recipes', result.recipe.id]);
  }

  removePhoto(): void {
    this.activePhotoFile.set(null);
    this.photoPreviewUrl.set(null);
    this.photoWarning.set(null);
  }

  private buildRecipePayload(includeBaseRecipeId: boolean): {
    recipeData: RecipeInput;
    ingredients: RecipeIngredientInput[];
  } {
    const value = this.form.getRawValue();
    const recipeData: RecipeInput = {
      title: value.title!.trim(),
      description: value.description?.trim() || null,
      prep_time_minutes: this.toNumberOrNull(value.prep_time_minutes),
      cook_time_minutes: this.toNumberOrNull(value.cook_time_minutes),
      portions: this.toNumberOrNull(value.portions),
      tags: this.tags(),
      base_recipe_id: includeBaseRecipeId ? this.baseRecipeId : null,
      meal_type: value.meal_type || null,
      category: value.category?.trim() || null,
      difficulty: value.difficulty || null,
      instructions: this.instructions.controls
        .map((group) => String(group.get('text')?.value ?? '').trim())
        .filter((step) => step.length > 0),
    };

    const ingredients: RecipeIngredientInput[] = this.ingredients.controls
      .map((group) => {
        const raw = group.getRawValue() as {
          name: string | null;
          quantity: number | null;
          unit: string | null;
          unit_custom: string | null;
        };
        return {
          name: (raw.name ?? '').trim(),
          quantity: this.toNumberOrNull(raw.quantity),
          unit: resolveStoredUnit(raw.unit, raw.unit_custom),
        };
      })
      .filter((ingredient) => ingredient.name.length > 0);

    return { recipeData, ingredients };
  }

  private captureSnapshot(): RecipeFormSnapshot {
    const value = this.form.getRawValue();
    return {
      title: (value.title ?? '').trim(),
      description: (value.description ?? '').trim(),
      prep_time_minutes: this.toNumberOrNull(value.prep_time_minutes),
      cook_time_minutes: this.toNumberOrNull(value.cook_time_minutes),
      portions: this.toNumberOrNull(value.portions),
      meal_type: value.meal_type ?? '',
      category: (value.category ?? '').trim(),
      difficulty: value.difficulty ?? '',
      tags: [...this.tags()].sort(),
      rating: this.rating(),
      ingredients: this.ingredients.controls.map((group) => {
        const raw = group.getRawValue() as {
          name: string | null;
          quantity: number | null;
          unit: string | null;
          unit_custom: string | null;
        };
        return {
          name: (raw.name ?? '').trim(),
          quantity: this.toNumberOrNull(raw.quantity),
          unit: resolveStoredUnit(raw.unit, raw.unit_custom),
        };
      }),
      instructions: this.instructions.controls
        .map((group) => String(group.get('text')?.value ?? '').trim())
        .filter((step) => step.length > 0),
    };
  }

  private snapshotsEqual(a: RecipeFormSnapshot, b: RecipeFormSnapshot): boolean {
    if (
      a.title !== b.title ||
      a.description !== b.description ||
      a.prep_time_minutes !== b.prep_time_minutes ||
      a.cook_time_minutes !== b.cook_time_minutes ||
      a.portions !== b.portions ||
      a.meal_type !== b.meal_type ||
      a.category !== b.category ||
      a.difficulty !== b.difficulty ||
      a.rating !== b.rating
    ) {
      return false;
    }

    if (a.tags.length !== b.tags.length || a.tags.some((tag, index) => tag !== b.tags[index])) {
      return false;
    }

    if (a.instructions.length !== b.instructions.length) {
      return false;
    }
    if (a.instructions.some((step, index) => step !== b.instructions[index])) {
      return false;
    }

    if (a.ingredients.length !== b.ingredients.length) {
      return false;
    }

    return a.ingredients.every(
      (ingredient, index) =>
        ingredient.name === b.ingredients[index].name &&
        ingredient.quantity === b.ingredients[index].quantity &&
        ingredient.unit === b.ingredients[index].unit
    );
  }

  private startImagePollingIfNeeded(recipe: Recipe): void {
    if (recipe.image_status !== 'generating' && recipe.image_status !== 'pending') {
      return;
    }

    this.stopImagePolling();
    this.imagePollAttempts = 0;

    this.imagePollTimer = setInterval(() => {
      void this.pollRecipeImage(recipe.id);
    }, 3000);
  }

  private async pollRecipeImage(recipeId: string): Promise<void> {
    this.imagePollAttempts += 1;

    if (this.imagePollAttempts > this.maxImagePollAttempts) {
      this.stopImagePolling();
      return;
    }

    const { recipe, error } = await this.recipeService.getRecipeById(recipeId);
    if (error || !recipe) {
      this.stopImagePolling();
      return;
    }

    this.loadedRecipe.set(recipe);

    if (recipe.image_status === 'completed' || recipe.image_status === 'failed') {
      this.stopImagePolling();
    }
  }

  private stopImagePolling(): void {
    if (this.imagePollTimer !== null) {
      clearInterval(this.imagePollTimer);
      this.imagePollTimer = null;
    }
  }

  private async attachPhotoToRecipe(recipeId: string, file: File): Promise<string | null> {
    try {
      const imageUrl = await this.photoService.uploadRecipePhoto(file);
      const { error } = await this.recipeService.updateRecipeImageMetadata(recipeId, {
        image_url: imageUrl,
        image_status: 'completed',
        image_storage_provider: environment.useLocalApi ? null : 'supabase_storage',
        image_error: null,
      });
      if (error) {
        return 'Recipe saved, but the photo could not be attached. You can add an image later.';
      }
      return null;
    } catch {
      return 'Recipe saved, but the photo could not be uploaded. You can add an image later.';
    }
  }

  private applyPhotoDraft(draft: RecipePhotoDraft): void {
    this.activePhotoFile.set(draft.file);
    this.photoPreviewUrl.set(draft.previewUrl);

    const analysis = draft.analysis;
    if (analysis?.suggestedName && !this.form.controls.title.value?.trim()) {
      this.form.controls.title.setValue(analysis.suggestedName);
    }
    if (analysis?.suggestedMealType) {
      this.form.controls.meal_type.setValue(analysis.suggestedMealType);
    }
    if (analysis?.possibleIngredients?.length) {
      for (const ingredient of analysis.possibleIngredients) {
        this.ingredients.push(this.buildIngredientGroup(ingredient));
      }
    }
  }

  private applyVoiceDraft(draft: RecipeVoiceDraft): void {
    this.form.patchValue({
      title: draft.title,
      description: draft.description ?? '',
      prep_time_minutes: draft.prep_time_minutes,
      cook_time_minutes: draft.cook_time_minutes,
      portions: draft.portions,
    });

    for (const ingredient of draft.ingredients) {
      this.ingredients.push(
        this.buildIngredientGroup(ingredient.name, ingredient.quantity ?? null, ingredient.unit ?? null)
      );
    }

    for (const step of draft.instructions) {
      this.instructions.push(this.buildInstructionGroup(step));
    }
  }

  private buildInstructionGroup(text = ''): FormGroup {
    return this.fb.group({
      text: [text],
    });
  }

  private buildIngredientGroup(
    name = '',
    quantity: number | null = null,
    unit: string | null = null,
    category: string | null = null
  ): FormGroup {
    const unitFields = resolveUnitFormFields(unit);
    const group = this.fb.group({
      name: [name, Validators.required],
      quantity: [quantity],
      unit: [unitFields.unit],
      unit_custom: [unitFields.unit_custom],
      category: [category ?? ''],
    });

    group.controls.unit.valueChanges.subscribe((selectedUnit) => {
      this.syncUnitCustomValidators(group.controls.unit_custom, selectedUnit);
    });

    return group;
  }

  private syncUnitCustomValidators(
    customControl: FormControl<string | null>,
    unit: string | null | undefined
  ): void {
    if (unit === FOOD_UNIT_OTHER) {
      customControl.setValidators(Validators.required);
    } else {
      customControl.clearValidators();
    }
    customControl.updateValueAndValidity({ emitEvent: false });
  }

  private applySelectionPayload(target: FormGroup, option: SearchSelectOption): void {
    const patch: Record<string, string> = {};

    if (this.isHistoryEntry(option.payload)) {
      if (option.payload.category) {
        patch['category'] = option.payload.category;
      }
      const hasUnit = !!resolveStoredUnit(
        target.get('unit')?.value as string | null,
        target.get('unit_custom')?.value as string | null
      );
      if (option.payload.unit && !hasUnit) {
        Object.assign(patch, resolveUnitFormFields(option.payload.unit));
      }
    } else if (this.isCatalogItem(option.payload)) {
      patch['category'] = option.payload.category_name;
    }

    if (Object.keys(patch).length > 0) {
      target.patchValue(patch);
    }
  }

  private isHistoryEntry(payload: unknown): payload is FoodItemHistory {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'user_id' in payload &&
      'last_used_at' in payload &&
      !('category_id' in payload)
    );
  }

  private isCatalogItem(payload: unknown): payload is FoodCatalogItem {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'category_id' in payload &&
      'category_name' in payload
    );
  }

  private toNumberOrNull(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }
}
