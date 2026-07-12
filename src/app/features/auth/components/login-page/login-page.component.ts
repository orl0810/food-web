import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import { LoginUiState } from '../../../../core/models/auth.model';
import { AuthFacadeService } from '../../services/auth-facade.service';
import { AuthLayoutComponent } from '../auth-layout/auth-layout.component';
import { MAGIC_LINK_RESEND_COOLDOWN_SECONDS } from '../../../../core/utils/auth-error.utils';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordsMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, AuthLayoutComponent, RouterLink],
  template: `
    <app-auth-layout>
      <div class="card w-full max-w-md p-8">
        <h1 class="page-title">Welcome to PantryFlow</h1>
        <p class="page-subtitle">Plan your meals, reduce waste, and cook smarter.</p>

        @if (uiState() === 'linkSent') {
          <div class="mt-6 space-y-4" aria-live="polite">
            <div class="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <p class="font-medium">Check your email</p>
              <p class="mt-1">We sent a secure link to <strong>{{ sentEmail() }}</strong>.</p>
            </div>
            @if (error()) {
              <p class="text-sm text-red-600" role="alert">{{ error() }}</p>
            }
            <button
              type="button"
              class="btn-secondary w-full"
              [disabled]="resending() || resendCooldownRemaining() > 0"
              (click)="resendMagicLink()"
            >
              @if (resending()) {
                Sending…
              } @else if (resendCooldownRemaining() > 0) {
                Resend link in {{ resendCooldownRemaining() }}s
              } @else {
                Resend link
              }
            </button>
            <button
              type="button"
              class="w-full text-sm font-medium text-brand-700 hover:text-brand-800"
              (click)="switchToPassword()"
            >
              Use password instead
            </button>
            <button
              type="button"
              class="w-full text-sm font-medium text-brand-700 hover:text-brand-800"
              (click)="backToEmail()"
            >
              Use a different email
            </button>
          </div>
        } @else if (passwordMode()) {
          <form class="mt-6 space-y-4" [formGroup]="passwordForm" (ngSubmit)="submitPassword()">
            <div>
              <label for="pw-email" class="mb-1 block text-sm font-medium text-stone-700">
                Email
              </label>
              <input
                id="pw-email"
                type="email"
                formControlName="email"
                autocomplete="email"
                class="input"
                placeholder="you@example.com"
              />
              @if (passwordForm.controls.email.touched && passwordForm.controls.email.invalid) {
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
                [attr.autocomplete]="signUpMode() ? 'new-password' : 'current-password'"
                class="input"
                placeholder="At least 6 characters"
              />
              @if (passwordForm.controls.password.touched && passwordForm.controls.password.invalid) {
                <p class="mt-1 text-sm text-red-600">
                  Password must be at least 6 characters.
                </p>
              }
            </div>

            @if (signUpMode()) {
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
                  passwordForm.controls.confirmPassword.touched &&
                  passwordForm.hasError('passwordsMismatch')
                ) {
                  <p class="mt-1 text-sm text-red-600">Passwords do not match.</p>
                }
              </div>
            }

            @if (error()) {
              <p class="text-sm text-red-600" role="alert">{{ error() }}</p>
            }

            @if (confirmationSent()) {
              <div class="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700" aria-live="polite">
                Account created. Check your email to confirm your address, then sign in.
              </div>
            } @else {
              <button
                type="submit"
                class="btn-primary w-full"
                [disabled]="passwordForm.invalid || submitting()"
              >
                {{
                  submitting()
                    ? signUpMode()
                      ? 'Creating account…'
                      : 'Signing in…'
                    : signUpMode()
                      ? 'Create account'
                      : 'Sign in'
                }}
              </button>
            }

            @if (!signUpMode()) {
              <p class="text-center text-sm text-stone-600">
                <a routerLink="/auth/reset-password" class="font-medium text-brand-700 hover:text-brand-800">
                  Forgot password?
                </a>
              </p>
            }

            <p class="text-center text-sm text-stone-600">
              @if (signUpMode()) {
                Already have an account?
                <button
                  type="button"
                  class="font-medium text-brand-700 hover:text-brand-800"
                  (click)="toggleSignUp(false)"
                >
                  Sign in
                </button>
              } @else {
                Don't have an account?
                <button
                  type="button"
                  class="font-medium text-brand-700 hover:text-brand-800"
                  (click)="toggleSignUp(true)"
                >
                  Create one
                </button>
              }
            </p>

            @if (!useLocalApi) {
              <p class="text-center text-sm text-stone-600">
                <button
                  type="button"
                  class="font-medium text-brand-700 hover:text-brand-800"
                  (click)="switchToMagicLink()"
                >
                  Use email link instead
                </button>
              </p>
            }

            <p class="text-center text-xs leading-5 text-stone-500">
              By continuing, you agree to our
              <a routerLink="/terms" class="font-medium text-brand-700 hover:text-brand-800">Terms</a>
              and acknowledge our
              <a routerLink="/privacy" class="font-medium text-brand-700 hover:text-brand-800">Privacy Policy</a>.
            </p>
          </form>
        } @else {
          <form class="mt-6 space-y-4" [formGroup]="magicLinkForm" (ngSubmit)="submitMagicLink()">
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
              @if (magicLinkForm.controls.email.touched && magicLinkForm.controls.email.invalid) {
                <p class="mt-1 text-sm text-red-600">Enter a valid email address.</p>
              }
            </div>

            @if (error()) {
              <p class="text-sm text-red-600" role="alert">{{ error() }}</p>
            }

            <button
              type="submit"
              class="btn-primary w-full"
              [disabled]="magicLinkForm.invalid || submitting()"
            >
              {{ submitting() ? 'Sending link…' : 'Continue with email' }}
            </button>

            <p class="text-center text-xs text-stone-500">
              We'll send you a secure login link.
            </p>

            <p class="text-center text-xs leading-5 text-stone-500">
              By continuing, you agree to our
              <a routerLink="/terms" class="font-medium text-brand-700 hover:text-brand-800">Terms</a>
              and acknowledge our
              <a routerLink="/privacy" class="font-medium text-brand-700 hover:text-brand-800">Privacy Policy</a>.
            </p>

            <p class="text-center text-sm text-stone-600">
              <button
                type="button"
                class="font-medium text-brand-700 hover:text-brand-800"
                (click)="switchToPassword()"
              >
                Use password instead
              </button>
            </p>
          </form>
        }
      </div>
    </app-auth-layout>
  `,
})
export class LoginPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly authFacade = inject(AuthFacadeService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  private resendCooldownTimer: ReturnType<typeof setInterval> | null = null;

  readonly useLocalApi = environment.useLocalApi;

  readonly magicLinkForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: [''],
    },
    { validators: passwordsMatch }
  );

  readonly uiState = signal<LoginUiState>('idle');
  readonly passwordMode = signal(false);
  readonly signUpMode = signal(false);
  readonly submitting = signal(false);
  readonly resending = signal(false);
  readonly confirmationSent = signal(false);
  readonly error = signal<string | null>(null);
  readonly sentEmail = signal('');
  readonly resendCooldownRemaining = signal(0);

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('mode') === 'signup') {
      this.passwordMode.set(true);
      this.signUpMode.set(true);
      this.passwordForm.controls.confirmPassword.addValidators(Validators.required);
      this.passwordForm.controls.confirmPassword.updateValueAndValidity();
    }
    if (this.useLocalApi || environment.production) {
      this.passwordMode.set(true);
    }
  }

  ngOnDestroy(): void {
    this.clearResendCooldown();
  }

  switchToPassword(): void {
    this.passwordMode.set(true);
    this.error.set(null);
    this.uiState.set('idle');
    const email = this.magicLinkForm.controls.email.value;
    if (email) {
      this.passwordForm.controls.email.setValue(email);
    }
  }

  switchToMagicLink(): void {
    this.passwordMode.set(false);
    this.signUpMode.set(false);
    this.confirmationSent.set(false);
    this.error.set(null);
    this.uiState.set('idle');
    const email = this.passwordForm.controls.email.value;
    if (email) {
      this.magicLinkForm.controls.email.setValue(email);
    }
  }

  toggleSignUp(enabled: boolean): void {
    this.signUpMode.set(enabled);
    this.confirmationSent.set(false);
    this.error.set(null);
    this.passwordForm.controls.confirmPassword.reset();
    const confirmControl = this.passwordForm.controls.confirmPassword;
    if (enabled) {
      confirmControl.setValidators([Validators.required, Validators.minLength(6)]);
    } else {
      confirmControl.clearValidators();
    }
    confirmControl.updateValueAndValidity();
  }

  backToEmail(): void {
    this.uiState.set('idle');
    this.error.set(null);
    this.clearResendCooldown();
  }

  async submitMagicLink(): Promise<void> {
    if (this.magicLinkForm.invalid || this.submitting()) {
      this.magicLinkForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const email = this.magicLinkForm.controls.email.value.trim();
    const result = await this.authService.signInWithMagicLink(email);

    this.submitting.set(false);

    if (result.error) {
      this.error.set(result.error);
      this.uiState.set('error');
      return;
    }

    this.sentEmail.set(email);
    this.uiState.set('linkSent');
    this.startResendCooldown();
  }

  async resendMagicLink(): Promise<void> {
    if (this.resendCooldownRemaining() > 0 || this.resending()) {
      return;
    }

    const email = this.sentEmail() || this.magicLinkForm.controls.email.value.trim();
    if (!email) {
      return;
    }

    this.resending.set(true);
    this.error.set(null);

    const result = await this.authService.signInWithMagicLink(email);

    this.resending.set(false);

    if (result.error) {
      this.error.set(result.error);
      return;
    }

    this.startResendCooldown();
  }

  async submitPassword(): Promise<void> {
    if (this.passwordForm.invalid || this.submitting()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.confirmationSent.set(false);

    const email = this.passwordForm.controls.email.value.trim();
    const password = this.passwordForm.controls.password.value;

    const result = this.signUpMode()
      ? await this.authService.signUpWithPassword(email, password)
      : await this.authService.signInWithPassword(email, password);

    this.submitting.set(false);

    if (result.error) {
      this.error.set(result.error);
      return;
    }

    if (result.needsConfirmation) {
      this.confirmationSent.set(true);
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.error.set('Sign-in succeeded but no user session was found.');
      return;
    }

    this.uiState.set('redirecting');
    try {
      const target = await this.authFacade.handlePostLoginRedirect(user.id);
      await this.router.navigateByUrl(target);
    } catch (error) {
      this.uiState.set('idle');
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Signed in, but we could not load your profile. Try again or contact support.'
      );
    }
  }

  private startResendCooldown(): void {
    this.clearResendCooldown();
    this.resendCooldownRemaining.set(MAGIC_LINK_RESEND_COOLDOWN_SECONDS);

    this.resendCooldownTimer = setInterval(() => {
      const next = this.resendCooldownRemaining() - 1;
      if (next <= 0) {
        this.clearResendCooldown();
        return;
      }
      this.resendCooldownRemaining.set(next);
    }, 1000);
  }

  private clearResendCooldown(): void {
    if (this.resendCooldownTimer !== null) {
      clearInterval(this.resendCooldownTimer);
      this.resendCooldownTimer = null;
    }
    this.resendCooldownRemaining.set(0);
  }
}
