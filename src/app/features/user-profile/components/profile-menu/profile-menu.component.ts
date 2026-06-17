import { Component, HostListener, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
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
    await this.authService.signOut();
    await this.router.navigateByUrl('/auth/login');
  }
}
