import { Component, output } from '@angular/core';
import { AiRecipeGeneratorComponent } from './ai-recipe-generator.component';

@Component({
  selector: 'app-ai-recipe-dialog',
  standalone: true,
  imports: [AiRecipeGeneratorComponent],
  template: `
    <div
      class="fixed inset-x-0 top-16 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-[60] flex items-center justify-center bg-stone-900/40 p-4 md:bottom-0"
      (click)="closed.emit()"
    >
      <div
        class="card flex h-[70vh] max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden"
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
            Generate easy recipes from your inventory with AI
          </p>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <app-ai-recipe-generator [embedded]="true" />
        </div>

        <div class="flex shrink-0 justify-end border-t border-stone-200 px-5 py-4">
          <button type="button" class="btn-secondary" (click)="closed.emit()">Close</button>
        </div>
      </div>
    </div>
  `,
})
export class AiRecipeDialogComponent {
  readonly closed = output<void>();
}
