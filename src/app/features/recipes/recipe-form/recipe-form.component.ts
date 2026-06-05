import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FoodItemHistory } from '../../../core/models/food-item-history.model';
import {
  RecipeIngredientInput,
  RecipeInput,
} from '../../../core/models/recipe.model';
import { SearchSelectOption } from '../../../core/models/search-select-option.model';
import { FoodItemHistoryService } from '../../../core/services/food-item-history.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select.component';

@Component({
  selector: 'app-recipe-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoadingStateComponent, SearchSelectComponent],
  template: `
    @if (loading()) {
      <app-loading-state message="Loading recipe..." />
    } @else {
      <form class="space-y-6" [formGroup]="form" (ngSubmit)="submit()">
        <div class="flex items-center justify-between gap-4">
          <h1 class="text-2xl font-semibold text-stone-900">
            {{ isEdit() ? 'Edit recipe' : 'New recipe' }}
          </h1>
          <a
            [routerLink]="cancelLink()"
            class="text-sm text-stone-500 hover:text-stone-700"
          >
            Cancel
          </a>
        </div>

        <section class="space-y-4 rounded-xl border border-stone-200 bg-card p-5 shadow-sm">
          <div>
            <label for="title" class="mb-1 block text-sm font-medium text-stone-700">Title *</label>
            <input
              id="title"
              type="text"
              formControlName="title"
              class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="e.g. Tomato pasta"
            />
          </div>

          <div>
            <label for="description" class="mb-1 block text-sm font-medium text-stone-700">Description</label>
            <textarea
              id="description"
              rows="3"
              formControlName="description"
              class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
                class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label for="portions" class="mb-1 block text-sm font-medium text-stone-700">Portions</label>
              <input
                id="portions"
                type="number"
                min="0"
                step="1"
                formControlName="portions"
                class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>
        </section>

        <section class="space-y-3 rounded-xl border border-stone-200 bg-card p-5 shadow-sm">
          <h2 class="text-lg font-semibold text-stone-900">Tags</h2>
          @if (tags().length > 0) {
            <div class="flex flex-wrap gap-2">
              @for (tag of tags(); track tag) {
                <span class="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                  {{ tag }}
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
              class="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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

        <section class="space-y-3 rounded-xl border border-stone-200 bg-card p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-stone-900">Ingredients</h2>
            <button
              type="button"
              class="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              (click)="addIngredient()"
            >
              Add ingredient
            </button>
          </div>

          @if (ingredients.length === 0) {
            <p class="text-sm text-stone-500">No ingredients added yet.</p>
          }

          <div class="space-y-3" formArrayName="ingredients">
            @for (ingredient of ingredients.controls; track ingredient; let i = $index) {
              <div class="grid gap-2 sm:grid-cols-12" [formGroupName]="i">
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
                  class="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:col-span-2"
                />
                <input
                  type="text"
                  formControlName="unit"
                  placeholder="Unit"
                  class="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:col-span-3"
                />
                <button
                  type="button"
                  class="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 sm:col-span-1"
                  aria-label="Remove ingredient"
                  (click)="removeIngredient(i)"
                >
                  &times;
                </button>
              </div>
            }
          </div>
        </section>

        @if (error()) {
          <p class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</p>
        }

        <div class="flex justify-end gap-3">
          <a
            [routerLink]="cancelLink()"
            class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="form.invalid || saving()"
          >
            {{ saving() ? 'Saving...' : isEdit() ? 'Save changes' : 'Create recipe' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class RecipeFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);
  private readonly foodItemHistoryService = inject(FoodItemHistoryService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly tags = signal<string[]>([]);

  private recipeId: string | null = null;

  readonly ingredientOptions = computed<SearchSelectOption[]>(() => {
    this.foodItemHistoryService.history();
    return this.foodItemHistoryService.getHistoryOptions('');
  });

  readonly form = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    prep_time_minutes: [null as number | null],
    portions: [null as number | null],
    ingredients: this.fb.array<FormGroup>([]),
  });

  get ingredients(): FormArray<FormGroup> {
    return this.form.controls.ingredients;
  }

  isEdit(): boolean {
    return this.recipeId !== null;
  }

  cancelLink(): unknown[] {
    return this.recipeId ? ['/recipes', this.recipeId] : ['/recipes'];
  }

  async ngOnInit(): Promise<void> {
    void this.foodItemHistoryService.loadHistory();

    this.recipeId = this.route.snapshot.paramMap.get('id');

    if (!this.recipeId) {
      this.addIngredient();
      return;
    }

    this.loading.set(true);
    const { recipe, error } = await this.recipeService.getRecipeById(this.recipeId);
    this.loading.set(false);

    if (error || !recipe) {
      this.error.set(error ?? 'Recipe not found.');
      return;
    }

    this.form.patchValue({
      title: recipe.title,
      description: recipe.description ?? '',
      prep_time_minutes: recipe.prep_time_minutes,
      portions: recipe.portions,
    });
    this.tags.set([...recipe.tags]);

    const ingredients = recipe.ingredients ?? [];
    if (ingredients.length === 0) {
      this.addIngredient();
    } else {
      for (const ingredient of ingredients) {
        this.ingredients.push(
          this.buildIngredientGroup(ingredient.name, ingredient.quantity, ingredient.unit)
        );
      }
    }
  }

  nameControlAt(index: number): FormControl<string | null> {
    return this.ingredients.at(index).get('name') as FormControl<string | null>;
  }

  applyIngredientSelection(index: number, option: SearchSelectOption): void {
    const payload = option.payload as FoodItemHistory | undefined;
    const group = this.ingredients.at(index);
    const currentUnit = (group.get('unit')?.value ?? '').trim();
    if (payload?.unit && !currentUnit) {
      group.patchValue({ unit: payload.unit });
    }
  }

  addIngredient(): void {
    this.ingredients.push(this.buildIngredientGroup());
  }

  removeIngredient(index: number): void {
    this.ingredients.removeAt(index);
  }

  addTag(value: string): void {
    const tag = value.trim();
    if (!tag) {
      return;
    }
    if (this.tags().some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      return;
    }
    this.tags.update((tags) => [...tags, tag]);
  }

  removeTag(tag: string): void {
    this.tags.update((tags) => tags.filter((existing) => existing !== tag));
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();
    const recipeData: RecipeInput = {
      title: value.title!.trim(),
      description: value.description?.trim() || null,
      prep_time_minutes: this.toNumberOrNull(value.prep_time_minutes),
      portions: this.toNumberOrNull(value.portions),
      tags: this.tags(),
    };

    const ingredients: RecipeIngredientInput[] = this.ingredients.controls
      .map((group) => {
        const raw = group.getRawValue() as {
          name: string | null;
          quantity: number | null;
          unit: string | null;
        };
        return {
          name: (raw.name ?? '').trim(),
          quantity: this.toNumberOrNull(raw.quantity),
          unit: raw.unit?.trim() || null,
        };
      })
      .filter((ingredient) => ingredient.name.length > 0);

    const result = this.recipeId
      ? await this.recipeService.updateRecipe(this.recipeId, recipeData, ingredients)
      : await this.recipeService.createRecipe(recipeData, ingredients);

    this.saving.set(false);

    if (result.error || !result.recipe) {
      this.error.set(result.error ?? 'Could not save this recipe. Please try again.');
      return;
    }

    await this.router.navigate(['/recipes', result.recipe.id]);
  }

  private buildIngredientGroup(
    name = '',
    quantity: number | null = null,
    unit: string | null = null
  ): FormGroup {
    return this.fb.group({
      name: [name, Validators.required],
      quantity: [quantity],
      unit: [unit ?? ''],
    });
  }

  private toNumberOrNull(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }
}
