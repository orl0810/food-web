import { Component, OnDestroy, OnInit, input, output } from '@angular/core';
import { FoodItemHistory } from '../../../core/models/food-item-history.model';
import { FoodItem, FoodItemInsert } from '../../../core/models/food-item.model';
import { FoodItemFormComponent } from './food-item-form.component';

@Component({
  selector: 'app-food-item-form-dialog',
  standalone: true,
  imports: [FoodItemFormComponent],
  template: `
    <div
      class="fixed inset-0 z-dialog-elevated flex items-end justify-center bg-stone-900/50 p-4 sm:items-center"
      (click)="cancelled.emit()"
    >
      <div
        class="card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (click)="$event.stopPropagation()"
      >
        <div class="shrink-0 border-b border-stone-200 px-5 py-4">
          <h2 [id]="titleId" class="text-lg font-semibold text-stone-900">
            {{ item() ? 'Edit food item' : 'Add food item' }}
          </h2>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <app-food-item-form
            #foodForm
            [item]="item()"
            [prefillFromHistory]="prefillFromHistory()"
            [submitting]="submitting()"
            [error]="error()"
            (saved)="saved.emit($event)"
          />
        </div>

        <div class="flex shrink-0 justify-end gap-3 border-t border-stone-200 px-5 py-4">
          <button type="button" class="btn-secondary" (click)="cancelled.emit()">Cancel</button>
          <button
            type="button"
            class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="foodForm.form.invalid || submitting()"
            (click)="foodForm.submit()"
          >
            {{ submitting() ? 'Saving...' : item() ? 'Save changes' : 'Add item' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class FoodItemFormDialogComponent implements OnInit, OnDestroy {
  readonly item = input<FoodItem | null>(null);
  readonly prefillFromHistory = input<FoodItemHistory | null>(null);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly saved = output<FoodItemInsert>();
  readonly cancelled = output<void>();

  get titleId(): string {
    return this.item() ? 'edit-food-item-title' : 'add-food-item-title';
  }

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
  }
}
