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
import { FormatTagPipe } from '../../../shared/pipes/format-tag.pipe';
import { normalizeTag } from '../../../shared/utils/tag.utils';

@Component({
  selector: 'app-recipe-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoadingStateComponent, SearchSelectComponent, FormatTagPipe],
  template: `
    @if (loading()) {
      <app-loading-state message="Loading recipe..." />
    } @else {
      <form class="page" [formGroup]="form" (ngSubmit)="submit()">
        <div class="flex items-center justify-between gap-4">
          <h1 class="page-title">
            {{ isEdit() ? 'Edit recipe' : 'New recipe' }}
          </h1>
          <a
            [routerLink]="cancelLink()"
            class="text-sm text-stone-500 hover:text-stone-700"
          >
            Cancel
          </a>
        </div>

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
          </div>
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
                      <input
                        type="text"
                        formControlName="unit"
                        placeholder="Unit"
                        class="input bg-white sm:col-span-3"
                      />
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
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-stone-200/80"
                      aria-hidden="true"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="h-4 w-4 text-stone-400"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H5.25A2.25 2.25 0 0 0 3 5.25v13.5A2.25 2.25 0 0 0 5.25 21Z"
                        />
                      </svg>
                    </div>

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
                <input
                  type="text"
                  formControlName="unit"
                  placeholder="Unit"
                  class="input bg-white sm:col-span-4"
                />
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

        <div class="flex justify-end gap-3">
          <a [routerLink]="cancelLink()" class="btn-secondary">
            Cancel
          </a>
          <button
            type="submit"
            class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
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
  readonly editingIndex = signal<number | null>(null);
  readonly showAddForm = signal(false);

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

  readonly draftForm = this.fb.group({
    name: ['', Validators.required],
    quantity: [null as number | null],
    unit: [''],
  });

  readonly draftNameControl = this.draftForm.get('name') as FormControl<string | null>;

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
    void this.foodItemHistoryService.loadAllHistory();

    this.recipeId = this.route.snapshot.paramMap.get('id');

    if (!this.recipeId) {
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
    for (const ingredient of ingredients) {
      this.ingredients.push(
        this.buildIngredientGroup(ingredient.name, ingredient.quantity, ingredient.unit)
      );
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

  applyDraftSelection(option: SearchSelectOption): void {
    const payload = option.payload as FoodItemHistory | undefined;
    const currentUnit = (this.draftForm.get('unit')?.value ?? '').trim();
    if (payload?.unit && !currentUnit) {
      this.draftForm.patchValue({ unit: payload.unit });
    }
  }

  ingredientLabel(index: number): string {
    return ((this.ingredients.at(index).get('name')?.value as string) ?? '').trim();
  }

  ingredientQuantityLabel(index: number): string | null {
    const group = this.ingredients.at(index);
    const quantity = this.toNumberOrNull(group.get('quantity')?.value as number | null);
    const unit = ((group.get('unit')?.value as string) ?? '').trim();

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
    this.draftForm.reset({ name: '', quantity: null, unit: '' });
    this.showAddForm.set(false);
  }

  finishEdit(index: number): void {
    const group = this.ingredients.at(index);
    const name = ((group.get('name')?.value as string) ?? '').trim();
    if (!name) {
      group.get('name')?.markAsTouched();
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

    const quantity = this.toNumberOrNull(this.draftForm.get('quantity')?.value as number | null);
    const unit = ((this.draftForm.get('unit')?.value as string) ?? '').trim() || null;

    this.ingredients.push(this.buildIngredientGroup(name, quantity, unit));
    this.draftForm.reset({ name: '', quantity: null, unit: '' });
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
