import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthFacadeService } from '../../services/auth-facade.service';
import { AuthLayoutComponent } from '../auth-layout/auth-layout.component';

@Component({
  selector: 'app-auth-callback-page',
  standalone: true,
  imports: [AuthLayoutComponent, RouterLink],
  template: `
    <app-auth-layout>
      <div class="card w-full max-w-md p-8 text-center">
        @if (state() === 'loading') {
          <h1 class="page-title">Signing you in…</h1>
          <p class="page-subtitle mt-2">Please wait while we verify your link.</p>
          <div
            class="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
            role="status"
            aria-label="Loading"
          ></div>
        } @else if (state() === 'error') {
          <h1 class="page-title">Sign-in link expired</h1>
          <p class="page-subtitle mt-2" role="alert">{{ error() }}</p>
          <a routerLink="/auth/login" class="btn-primary mt-6 inline-block w-full text-center">
            Back to sign in
          </a>
        }
      </div>
    </app-auth-layout>
  `,
})
export class AuthCallbackPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly authFacade = inject(AuthFacadeService);
  private readonly router = inject(Router);

  readonly state = signal<'loading' | 'error'>('loading');
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.authService.whenReady();

    if (this.authService.isRecoverySession()) {
      await this.router.navigateByUrl('/auth/reset-password');
      return;
    }

    const result = await this.authService.handleAuthCallback();

    if (result.error || !result.session?.user) {
      this.error.set(result.error ?? 'Unable to complete sign-in.');
      this.state.set('error');
      return;
    }

    const target = await this.authFacade.handlePostLoginRedirect(result.session.user.id);
    await this.router.navigateByUrl(target);
  }
}
