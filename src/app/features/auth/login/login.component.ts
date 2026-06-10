import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { OnboardingService } from '../../../core/services/onboarding.service';

type AuthMode = 'sign_in' | 'sign_up';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-surface px-4">
      <div class="card w-full max-w-md p-8">
        <h1 class="page-title">PantryFlow</h1>
        <p class="page-subtitle">
          {{ mode() === 'sign_in' ? 'Sign in to manage your food inventory.' : 'Create an account to get started.' }}
        </p>

        @if (confirmationSent()) {
          <div class="mt-6 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
            Account created. Check your email to confirm your address, then sign in.
          </div>
          <button
            type="button"
            class="mt-4 text-sm font-medium text-brand-700 hover:text-brand-800"
            (click)="switchMode('sign_in')"
          >
            Back to sign in
          </button>
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
                class="input"
                placeholder="you@example.com"
              />
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <p class="mt-1 text-sm text-red-600">Enter a valid email address.</p>
              }
            </div>

            <div>
              <label for="password" class="mb-1 block text-sm font-medium text-stone-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                formControlName="password"
                [attr.autocomplete]="mode() === 'sign_in' ? 'current-password' : 'new-password'"
                class="input"
                placeholder="At least 6 characters"
              />
              @if (form.controls.password.touched && form.controls.password.invalid) {
                <p class="mt-1 text-sm text-red-600">Password must be at least 6 characters.</p>
              }
            </div>

            @if (error()) {
              <p class="text-sm text-red-600">{{ error() }}</p>
            }

            <button type="submit" class="btn-primary w-full" [disabled]="form.invalid || submitting()">
              {{
                submitting()
                  ? mode() === 'sign_in'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode() === 'sign_in'
                    ? 'Sign in'
                    : 'Create account'
              }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-stone-600">
            @if (mode() === 'sign_in') {
              Don't have an account?
              <button
                type="button"
                class="font-medium text-brand-700 hover:text-brand-800"
                (click)="switchMode('sign_up')"
              >
                Create one
              </button>
            } @else {
              Already have an account?
              <button
                type="button"
                class="font-medium text-brand-700 hover:text-brand-800"
                (click)="switchMode('sign_in')"
              >
                Sign in
              </button>
            }
          </p>
        }
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly mode = signal<AuthMode>('sign_in');
  readonly submitting = signal(false);
  readonly confirmationSent = signal(false);
  readonly error = signal<string | null>(null);

  switchMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.confirmationSent.set(false);
    this.form.controls.password.reset();
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const email = this.form.controls.email.value;
    const password = this.form.controls.password.value;

    const result =
      this.mode() === 'sign_in'
        ? await this.authService.signInWithPassword(email, password)
        : await this.authService.signUpWithPassword(email, password);

    this.submitting.set(false);

    if (result.error) {
      this.error.set(result.error);
      return;
    }

    if (result.needsConfirmation) {
      this.confirmationSent.set(true);
      return;
    }

    const status = await this.onboardingService.getStatus();
    const target =
      status.status === 'pending' || status.status === 'in_progress'
        ? '/onboarding'
        : '/dashboard';
    await this.router.navigateByUrl(target);
  }
}
