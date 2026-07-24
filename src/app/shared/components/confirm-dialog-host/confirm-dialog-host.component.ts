import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog-host',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (dialogService.pending(); as pending) {
      <div
        class="fixed inset-0 z-[80] flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
        role="presentation"
        (click)="onBackdrop(pending.request.variant)"
      >
        <div
          class="card w-full max-w-md overflow-hidden p-5"
          style="max-height: min(85dvh, 85vh)"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          (click)="$event.stopPropagation()"
        >
          <h2 [id]="titleId" class="text-base font-semibold text-stone-900">
            {{ pending.request.title }}
          </h2>
          <p class="mt-2 text-sm text-stone-600">{{ pending.request.message }}</p>

          @if (pending.request.variant === 'prompt') {
            <label class="mt-4 block">
              <span class="mb-1 block text-sm font-medium text-stone-700">
                {{ pending.request.promptLabel }}
              </span>
              <input
                type="text"
                class="input"
                [(ngModel)]="promptValue"
                [attr.aria-label]="pending.request.promptLabel"
                (keydown.enter)="onConfirm(pending.request.variant)"
              />
            </label>
          }

          <div class="mt-5 flex flex-wrap justify-end gap-2">
            @if (pending.request.variant !== 'alert') {
              <button
                type="button"
                class="btn-secondary touch-target-inline px-4"
                (click)="dialogService.resolve(pending.request.variant === 'prompt' ? null : false)"
              >
                {{ pending.request.cancelLabel }}
              </button>
            }
            <button
              type="button"
              class="touch-target-inline px-4"
              [class]="pending.request.danger ? 'btn-danger' : 'btn-primary'"
              (click)="onConfirm(pending.request.variant)"
            >
              {{ pending.request.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogHostComponent {
  readonly dialogService = inject(ConfirmDialogService);
  readonly titleId = 'confirm-dialog-title';
  promptValue = '';

  constructor() {
    effect(() => {
      const pending = this.dialogService.pending();
      this.promptValue = pending?.request.promptDefault ?? '';
      if (pending) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });
  }

  onBackdrop(variant: string): void {
    if (variant === 'alert') {
      this.dialogService.resolve(true);
      return;
    }
    this.dialogService.resolve(variant === 'prompt' ? null : false);
  }

  onConfirm(variant: string): void {
    if (variant === 'prompt') {
      this.dialogService.resolve(this.promptValue);
      return;
    }
    this.dialogService.resolve(true);
  }
}
