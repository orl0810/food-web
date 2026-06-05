import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [RouterLink, LoadingStateComponent],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-surface px-4">
      <div class="w-full max-w-md rounded-2xl border border-stone-200 bg-card p-8 text-center shadow-sm">
        @if (loading()) {
          <app-loading-state message="Signing you in..." />
        } @else if (error()) {
          <h1 class="text-lg font-semibold text-stone-900">Sign-in failed</h1>
          <p class="mt-2 text-sm text-stone-600">{{ error() }}</p>
          <a
            routerLink="/login"
            class="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Back to login
          </a>
        }
      </div>
    </div>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.completeSignIn();
  }

  private async completeSignIn(): Promise<void> {
    await this.authService.init();
    const { error } = await this.authService.handleAuthCallback();

    this.loading.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    await this.router.navigateByUrl('/dashboard');
  }
}
