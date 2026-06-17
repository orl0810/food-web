import { Component, input, output } from '@angular/core';
import { FoodItemHistory } from '../../../core/models/food-item-history.model';
import { FoodItem, FoodItemInsert } from '../../../core/models/food-item.model';
import { FoodItemFormComponent } from './food-item-form.component';

@Component({
  selector: 'app-food-item-form-dialog',
  standalone: true,
  imports: [FoodItemFormComponent],
  template: `
    <div
      class="fixed inset-x-0 top-16 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-[60] flex items-center justify-center overflow-y-auto bg-stone-900/40 p-4 md:bottom-0"
      (click)="cancelled.emit()"
    >
      <div
        class="card my-auto w-full max-w-lg max-h-full overflow-y-auto p-5"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="item() ? 'edit-food-item-title' : 'add-food-item-title'"
        (click)="$event.stopPropagation()"
      >
        <app-food-item-form
          [item]="item()"
          [prefillFromHistory]="prefillFromHistory()"
          [submitting]="submitting()"
          [error]="error()"
          [titleId]="item() ? 'edit-food-item-title' : 'add-food-item-title'"
          (saved)="saved.emit($event)"
          (cancelled)="cancelled.emit()"
        />
      </div>
    </div>
  `,
})
export class FoodItemFormDialogComponent {
  readonly item = input<FoodItem | null>(null);
  readonly prefillFromHistory = input<FoodItemHistory | null>(null);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly saved = output<FoodItemInsert>();
  readonly cancelled = output<void>();
}
