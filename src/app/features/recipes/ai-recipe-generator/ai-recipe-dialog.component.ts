import { Component, OnDestroy, OnInit, output } from '@angular/core';
import { AiRecipeGeneratorComponent } from './ai-recipe-generator.component';

@Component({
  selector: 'app-ai-recipe-dialog',
  standalone: true,
  imports: [AiRecipeGeneratorComponent],
  template: `
    <div
      class="fixed inset-0 z-dialog-elevated flex items-center justify-center bg-stone-900/50 p-4"
      (click)="closed.emit()"
    >
      <div
        class="card flex h-[80vh] max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-recipe-dialog-title"
        (click)="$event.stopPropagation()"
      >
        <div class="shrink-0 border-b border-stone-200 px-5 py-4">
          <h2 id="ai-recipe-dialog-title" class="text-lg font-semibold text-stone-900">
            Create AI recipe
          </h2>
          <p class="mt-0.5 text-sm text-stone-600">
            Generate realistic recipes from your pantry or your own ideas
          </p>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <app-ai-recipe-generator #generator [embedded]="true" />
        </div>

        <div class="flex shrink-0 justify-end gap-3 border-t border-stone-200 px-5 py-4">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Close</button>
          <button
            type="button"
            class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="!generator.canGenerate()"
            (click)="generator.generateAiRecipes()"
          >
            {{ generator.aiRecipeService.loading() ? 'Generating...' : 'Generate suggestions' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AiRecipeDialogComponent implements OnInit, OnDestroy {
  readonly closed = output<void>();

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
  }
}
