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
        <div class="mx-auto max-w-5xl px-4 py-4">
          <div class="flex items-center justify-between">
            <a routerLink="/dashboard" class="text-lg font-semibold text-brand-700">
              PantryFlow
            </a>
            <button
              type="button"
              class="text-sm text-stone-500 transition-colors hover:text-stone-700"
              (click)="signOut()"
            >
              Log out
            </button>
          </div>
          <nav class="mt-3 flex gap-1">
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
            <a
              routerLink="/recipes"
              routerLinkActive="bg-brand-50 text-brand-700"
              class="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Recipes
            </a>
            <a
              routerLink="/meal-plan"
              routerLinkActive="bg-brand-50 text-brand-700"
              class="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Meal Plan
            </a>
            <a
              routerLink="/shopping-list"
              routerLinkActive="bg-brand-50 text-brand-700"
              class="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Shopping List
            </a>
          </nav>
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
