import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-surface px-4">
      <div class="w-full max-w-md rounded-2xl border border-stone-200 bg-card p-8 shadow-sm">
        <h1 class="text-2xl font-semibold text-stone-900">PantryFlow</h1>
        <p class="mt-2 text-sm text-stone-600">
          Sign in with a magic link sent to your email.
        </p>

        @if (sent()) {
          <div class="mt-6 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
            Check your email for a sign-in link. You can close this tab after clicking it.
          </div>
        } @else {
          <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
            <div>
              <label for="email" class="mb-1 block text-sm font-medium text-stone-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                formControlName="email"
                autocomplete="email"
                class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder="you@example.com"
              />
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <p class="mt-1 text-sm text-red-600">Enter a valid email address.</p>
              }
            </div>

            @if (error()) {
              <p class="text-sm text-red-600">{{ error() }}</p>
            }

            <button
              type="submit"
              class="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="form.invalid || submitting()"
            >
              {{ submitting() ? 'Sending link...' : 'Send magic link' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const { error } = await this.authService.signInWithMagicLink(this.form.controls.email.value);

    this.submitting.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    this.sent.set(true);
  }
}
