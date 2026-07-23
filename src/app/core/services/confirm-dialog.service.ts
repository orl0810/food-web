import { Injectable, signal } from '@angular/core';

export type ConfirmDialogVariant = 'confirm' | 'alert' | 'prompt';

export interface ConfirmDialogRequest {
  variant: ConfirmDialogVariant;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  promptDefault?: string;
  promptLabel?: string;
}

interface PendingDialog {
  request: ConfirmDialogRequest;
  resolve: (value: boolean | string | null) => void;
}

/**
 * In-app replacement for window.confirm / alert / prompt.
 * Hosted by ConfirmDialogHostComponent at the app root.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly pendingSignal = signal<PendingDialog | null>(null);

  readonly pending = this.pendingSignal.asReadonly();

  confirm(options: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }): Promise<boolean> {
    return this.open({
      variant: 'confirm',
      title: options.title ?? 'Confirm',
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirm',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      danger: options.danger ?? false,
    }).then((value) => value === true);
  }

  alert(options: { title?: string; message: string; confirmLabel?: string }): Promise<void> {
    return this.open({
      variant: 'alert',
      title: options.title ?? 'Notice',
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'OK',
    }).then(() => undefined);
  }

  prompt(options: {
    title?: string;
    message: string;
    defaultValue?: string;
    promptLabel?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<string | null> {
    return this.open({
      variant: 'prompt',
      title: options.title ?? 'Enter a value',
      message: options.message,
      promptDefault: options.defaultValue ?? '',
      promptLabel: options.promptLabel ?? 'Value',
      confirmLabel: options.confirmLabel ?? 'OK',
      cancelLabel: options.cancelLabel ?? 'Cancel',
    }).then((value) => (typeof value === 'string' ? value : null));
  }

  resolve(value: boolean | string | null): void {
    const pending = this.pendingSignal();
    if (!pending) {
      return;
    }
    this.pendingSignal.set(null);
    pending.resolve(value);
  }

  private open(request: ConfirmDialogRequest): Promise<boolean | string | null> {
    const existing = this.pendingSignal();
    if (existing) {
      existing.resolve(false);
    }

    return new Promise((resolve) => {
      this.pendingSignal.set({ request, resolve });
    });
  }
}
