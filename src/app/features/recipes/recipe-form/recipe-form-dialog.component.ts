import { Component, OnDestroy, OnInit, input, output } from '@angular/core';
import { Recipe } from '../../../core/models/recipe.model';
import { RecipeVoiceDraft } from '../../../core/models/voice-recipe.model';
import { RecipePhotoDraft } from '../../../core/models/photo-food-capture.model';
import { RecipeFormComponent } from './recipe-form.component';

@Component({
  selector: 'app-recipe-form-dialog',
  standalone: true,
  imports: [RecipeFormComponent],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/50 p-4"
      (click)="cancelled.emit()"
    >
      <div
        class="card flex h-[70vh] max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-recipe-title"
        (click)="$event.stopPropagation()"
      >
        <div class="shrink-0 border-b border-stone-200 px-5 py-4">
          <h2 id="create-recipe-title" class="text-lg font-semibold text-stone-900">New recipe</h2>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <app-recipe-form
            #recipeForm
            [embedded]="true"
            [initialDraft]="initialDraft()"
            [photoDraft]="photoDraft()"
            titleId="create-recipe-title"
            (saved)="saved.emit($event)"
            (cancelled)="cancelled.emit()"
          />
        </div>

        <div class="flex shrink-0 justify-end gap-3 border-t border-stone-200 px-5 py-4">
          <button type="button" class="btn-secondary" (click)="cancelled.emit()">Cancel</button>
          <button
            type="button"
            class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="recipeForm.form.invalid || recipeForm.saving()"
            (click)="recipeForm.submit()"
          >
            {{ recipeForm.saving() ? 'Calculating nutrition...' : 'Create recipe' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class RecipeFormDialogComponent implements OnInit, OnDestroy {
  readonly initialDraft = input<RecipeVoiceDraft | null>(null);
  readonly photoDraft = input<RecipePhotoDraft | null>(null);
  readonly saved = output<Recipe>();
  readonly cancelled = output<void>();

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
  }
}
