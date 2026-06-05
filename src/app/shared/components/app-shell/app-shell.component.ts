import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-surface">
      <header class="border-b border-stone-200 bg-card">
        <div class="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
            <a routerLink="/dashboard" class="text-lg font-semibold text-brand-700">
              PantryFlow
            </a>
            <nav class="flex gap-1">
              <a
                routerLink="/dashboard"
                routerLinkActive="bg-brand-50 text-brand-700"
                class="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Dashboard
              </a>
              <a
                routerLink="/inventory"
                routerLinkActive="bg-brand-50 text-brand-700"
                class="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Inventory
              </a>
            </nav>
          </div>
          <button
            type="button"
            class="self-start rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:self-auto"
            (click)="signOut()"
          >
            Log out
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-4 py-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }
}
