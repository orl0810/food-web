import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FoodIconService } from '../../../core/services/food-icon.service';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BottomNavComponent],
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
              <div class="relative">
                <button
                  type="button"
                  class="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
                  aria-label="Settings"
                  [attr.aria-expanded]="settingsOpen()"
                  (click)="toggleSettings($event)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </button>

                @if (settingsOpen()) {
                  <div
                    class="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-stone-200 bg-card py-1 shadow-lg"
                    (click)="$event.stopPropagation()"
                  >
                    <button
                      type="button"
                      class="w-full px-4 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-stone-50"
                      (click)="signOut()"
                    >
                      Log out
                    </button>
                  </div>
                }
              </div>

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

              <button
                type="button"
                class="rounded-lg p-2 text-stone-500"
                aria-label="User profile"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </button>

              <button
                type="button"
                class="hidden text-sm text-stone-500 transition-colors hover:text-stone-700 md:inline"
                (click)="signOut()"
              >
                Log out
              </button>
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
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly foodIconService = inject(FoodIconService);

  readonly settingsOpen = signal(false);

  constructor() {
    void this.foodIconService.preload();
  }

  toggleSettings(event: Event): void {
    event.stopPropagation();
    this.settingsOpen.update((open) => !open);
  }

  @HostListener('document:click')
  closeSettings(): void {
    this.settingsOpen.set(false);
  }

  async signOut(): Promise<void> {
    this.settingsOpen.set(false);
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }
}
