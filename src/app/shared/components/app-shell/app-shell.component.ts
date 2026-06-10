import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FoodIconService } from '../../../core/services/food-icon.service';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { ProfileMenuComponent } from '../../../features/user-profile/components/profile-menu/profile-menu.component';
import { UserProfileFacadeService } from '../../../features/user-profile/services/user-profile-facade.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BottomNavComponent, ProfileMenuComponent],
  template: `
    <div class="min-h-screen bg-surface">
      <header class="border-b border-stone-200 bg-card">
        <div class="mx-auto max-w-5xl px-4 py-4">
          <div class="flex items-center justify-between gap-4">
            <a routerLink="/dashboard" class="shrink-0 text-lg font-semibold text-brand-700">
              PantryFlow
            </a>

            <nav class="hidden items-center gap-1 md:flex">
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
                routerLink="/meal-plan"
                routerLinkActive="bg-brand-50 text-brand-700"
                class="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Meal Plan
              </a>
              <a
                routerLink="/recipes"
                routerLinkActive="bg-brand-50 text-brand-700"
                [routerLinkActiveOptions]="{ exact: false }"
                class="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Recipes
              </a>
              <a
                routerLink="/shopping-list"
                routerLinkActive="bg-brand-50 text-brand-700"
                class="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Shopping
              </a>
            </nav>

            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="relative rounded-lg p-2 text-stone-500"
                aria-label="Notifications"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" aria-hidden="true"></span>
              </button>

              <app-profile-menu />
            </div>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-4 py-6 pb-20 md:pb-6">
        <router-outlet />
      </main>

      <app-bottom-nav />
    </div>
  `,
})
export class AppShellComponent {
  private readonly foodIconService = inject(FoodIconService);
  private readonly userProfileFacade = inject(UserProfileFacadeService);

  constructor() {
    void this.foodIconService.preload();
    void this.userProfileFacade.loadAll();
  }
}
