import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FoodIconService } from '../../../core/services/food-icon.service';
import { ToCookPanelComponent } from '../../../features/meal-plan/components/to-cook-panel/to-cook-panel.component';
import { ToCookService } from '../../../features/meal-plan/services/to-cook.service';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { CookFabComponent } from '../cook-fab/cook-fab.component';
import { MealStreakBadgeComponent } from '../meal-streak-badge/meal-streak-badge.component';
import { ProfileMenuComponent } from '../../../features/user-profile/components/profile-menu/profile-menu.component';
import { UserProfileFacadeService } from '../../../features/user-profile/services/user-profile-facade.service';
import { MealStreakService } from '../../../core/services/meal-streak.service';
import { EntitlementService } from '../../../core/services/entitlement.service';
import { TrialStatusBannerComponent } from '../trial-status-banner/trial-status-banner.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BottomNavComponent, CookFabComponent, ToCookPanelComponent, MealStreakBadgeComponent, ProfileMenuComponent, TrialStatusBannerComponent],
  styles: `
    .app-shell-header {
      padding-top: var(--safe-area-top);
    }
  `,
  template: `
    <div class="min-h-screen bg-surface" style="min-height: 100dvh">
      <header class="app-shell-header border-b border-stone-200 bg-card">
        <div class="mx-auto max-w-5xl px-4 py-4">
          <div class="flex items-center justify-between gap-4">
            <a routerLink="/dashboard" class="shrink-0 text-lg font-semibold text-brand-700">
              Soozi
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
                class="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-stone-500"
                aria-label="Notifications"
                disabled
                title="Notifications coming soon"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </button>

              <app-meal-streak-badge />
              <app-profile-menu />
            </div>
          </div>
        </div>
      </header>

      <app-trial-status-banner />

      <main class="mx-auto max-w-5xl px-4 py-6 pb-28 md:pb-6">
        <router-outlet />
      </main>

      <app-cook-fab />
      @if (toCookService.panelOpen()) {
        <app-to-cook-panel />
      }

      <app-bottom-nav />
    </div>
  `,
})
export class AppShellComponent {
  private readonly foodIconService = inject(FoodIconService);
  private readonly userProfileFacade = inject(UserProfileFacadeService);
  private readonly mealStreakService = inject(MealStreakService);
  private readonly entitlementService = inject(EntitlementService);
  readonly toCookService = inject(ToCookService);

  constructor() {
    void this.foodIconService.preload();
    void this.userProfileFacade.loadAll();
    void this.mealStreakService.loadStreak();
    void this.toCookService.load();
    void this.entitlementService.load();
  }
}
