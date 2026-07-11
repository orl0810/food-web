import { Component, HostListener, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserProfileService } from '../../../../core/services/user-profile.service';
import { AdminAnalyticsService } from '../../../admin/services/admin-analytics.service';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';

@Component({
  selector: 'app-profile-menu',
  standalone: true,
  template: `
    <div class="relative">
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
        aria-label="User profile"
        [attr.aria-expanded]="open()"
        (click)="toggle($event)"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
          aria-hidden="true"
        >
          {{ facade.initials() }}
        </span>
      </button>

      @if (open()) {
        <div
          class="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-stone-200 bg-card p-4 shadow-lg"
          role="menu"
          (click)="$event.stopPropagation()"
          (keydown.escape)="close()"
        >
          <div class="flex items-center gap-3">
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-700"
              aria-hidden="true"
            >
              {{ facade.initials() }}
            </span>
            <div class="min-w-0">
              <p class="truncate font-semibold text-stone-900">{{ facade.displayName() }}</p>
              @if (facade.email()) {
                <p class="truncate text-xs text-stone-500">{{ facade.email() }}</p>
              }
            </div>
          </div>

          <p class="mt-3 text-xs leading-relaxed text-stone-600">
            Your meal planning profile helps us suggest better recipes.
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <span class="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              {{ facade.quickStats().mealsPlannedThisWeek }} planned this week
            </span>
            <span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              {{ facade.quickStats().completedWeeksStreak }}-week streak
            </span>
          </div>

          <div class="mt-4 space-y-1 border-t border-stone-100 pt-3">
            <button
              type="button"
              role="menuitem"
              class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50"
              (click)="navigate('/profile')"
            >
              View profile
            </button>
            <button
              type="button"
              role="menuitem"
              class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50"
              (click)="navigate('/profile', 'preferences')"
            >
              Preferences
            </button>
            <button
              type="button"
              role="menuitem"
              class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50"
              (click)="navigate('/profile', 'progress')"
            >
              Progress
            </button>
            @if (userProfileService.isAdmin()) {
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-50"
                (click)="navigate('/admin')"
              >
                <svg
                  class="h-4 w-4 shrink-0 text-stone-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1.5"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.298-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
                Go to Admin
              </button>
            }
            <button
              type="button"
              role="menuitem"
              class="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              (click)="signOut()"
            >
              Sign out
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProfileMenuComponent {
  readonly facade = inject(UserProfileFacadeService);
  readonly userProfileService = inject(UserProfileService);
  private readonly adminAnalyticsService = inject(AdminAnalyticsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly open = signal(false);
  readonly closed = output<void>();

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
    this.closed.emit();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.close();
  }

  navigate(path: string, section?: string): void {
    this.close();
    const queryParams = section ? { section } : undefined;
    void this.router.navigate([path], { queryParams });
  }

  async signOut(): Promise<void> {
    this.close();
    this.userProfileService.clearProfile();
    this.adminAnalyticsService.clear();
    await this.authService.signOut();
    await this.router.navigateByUrl('/auth/login');
  }
}
