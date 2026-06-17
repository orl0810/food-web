import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthFacadeService } from '../../services/auth-facade.service';
import { ResetPasswordMode } from '../../../../core/models/auth.model';
import { AuthLayoutComponent } from '../auth-layout/auth-layout.component';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordsMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, AuthLayoutComponent, RouterLink],
  template: `
    <app-auth-layout>
      <div class="card w-full max-w-md p-8">
        @if (mode() === 'request') {
          <h1 class="page-title">Reset your password</h1>
          <p class="page-subtitle">Enter your email and we'll send you a reset link.</p>

          @if (emailSent()) {
            <div class="mt-6 space-y-4" aria-live="polite">
              <div class="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
                <p class="font-medium">Check your email</p>
                <p class="mt-1">We sent password reset instructions to your inbox.</p>
              </div>
              <a routerLink="/auth/login" class="btn-secondary inline-block w-full text-center">
                Back to sign in
              </a>
            </div>
          } @else {
            <form class="mt-6 space-y-4" [formGroup]="requestForm" (ngSubmit)="submitRequest()">
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
                @if (requestForm.controls.email.touched && requestForm.controls.email.invalid) {
                  <p class="mt-1 text-sm text-red-600">Enter a valid email address.</p>
                }
              </div>

              @if (error()) {
                <p class="text-sm text-red-600" role="alert">{{ error() }}</p>
              }

              <button
                type="submit"
                class="btn-primary w-full"
                [disabled]="requestForm.invalid || submitting()"
              >
                {{ submitting() ? 'Sending…' : 'Send reset link' }}
              </button>

              <p class="text-center text-sm text-stone-600">
                <a routerLink="/auth/login" class="font-medium text-brand-700 hover:text-brand-800">
                  Back to sign in
                </a>
              </p>
            </form>
          }
        } @else {
          <h1 class="page-title">Choose a new password</h1>
          <p class="page-subtitle">Enter a new password for your account.</p>

          <form class="mt-6 space-y-4" [formGroup]="updateForm" (ngSubmit)="submitUpdate()">
            <div>
              <label for="password" class="mb-1 block text-sm font-medium text-stone-700">
                New password
              </label>
              <input
                id="password"
                type="password"
                formControlName="password"
                autocomplete="new-password"
                class="input"
                placeholder="At least 8 characters"
              />
              @if (updateForm.controls.password.touched && updateForm.controls.password.invalid) {
                <p class="mt-1 text-sm text-red-600">Password must be at least 8 characters.</p>
              }
            </div>

            <div>
              <label for="confirmPassword" class="mb-1 block text-sm font-medium text-stone-700">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                formControlName="confirmPassword"
                autocomplete="new-password"
                class="input"
                placeholder="Repeat your password"
              />
              @if (
                updateForm.controls.confirmPassword.touched &&
                updateForm.hasError('passwordsMismatch')
              ) {
                <p class="mt-1 text-sm text-red-600">Passwords do not match.</p>
              }
            </div>

            @if (error()) {
              <p class="text-sm text-red-600" role="alert">{{ error() }}</p>
            }

            <button
              type="submit"
              class="btn-primary w-full"
              [disabled]="updateForm.invalid || submitting()"
            >
              {{ submitting() ? 'Updating…' : 'Update password' }}
            </button>
          </form>
        }
      </div>
    </app-auth-layout>
  `,
})
export class ResetPasswordPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly authFacade = inject(AuthFacadeService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly requestForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly updateForm = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: passwordsMatch }
  );

  readonly mode = signal<ResetPasswordMode>('request');
  readonly submitting = signal(false);
  readonly emailSent = signal(false);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.authService.whenReady();

    if (this.authService.isRecoverySession()) {
      await this.authService.handleAuthCallback();
      this.mode.set('update');
    }
  }

  async submitRequest(): Promise<void> {
    if (this.requestForm.invalid || this.submitting()) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const result = await this.authService.resetPasswordForEmail(
      this.requestForm.controls.email.value.trim()
    );

    this.submitting.set(false);

    if (result.error) {
      this.error.set(result.error);
      return;
    }

    this.emailSent.set(true);
  }

  async submitUpdate(): Promise<void> {
    if (this.updateForm.invalid || this.submitting()) {
      this.updateForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const result = await this.authService.updatePassword(
      this.updateForm.controls.password.value
    );

    this.submitting.set(false);

    if (result.error) {
      this.error.set(result.error);
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      await this.router.navigateByUrl('/auth/login');
      return;
    }

    const target = await this.authFacade.handlePostLoginRedirect(user.id);
    await this.router.navigateByUrl(target);
  }
}
