import { Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';

@Component({
  selector: 'app-profile-summary-card',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="card p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span
          class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl font-semibold text-brand-700"
          aria-hidden="true"
        >
          {{ facade.initials() }}
        </span>

        <div class="min-w-0 flex-1">
          <h2 class="section-title">Profile summary</h2>
          <p class="mt-1 text-sm text-stone-600">
            Your meal planning profile helps us suggest better recipes.
          </p>

          @if (editing()) {
            <div class="mt-4 space-y-3">
              <label class="block text-sm font-medium text-stone-700" for="display-name">
                Display name
              </label>
              <input
                id="display-name"
                type="text"
                class="input"
                [formControl]="nameControl"
                maxlength="80"
              />
              <div class="flex gap-2">
                <button type="button" class="btn-primary-sm" (click)="saveName()">Save name</button>
                <button type="button" class="btn-secondary-sm" (click)="cancelEdit()">Cancel</button>
              </div>
            </div>
          } @else {
            <div class="mt-3">
              <p class="text-lg font-semibold text-stone-900">{{ facade.displayName() }}</p>
              @if (facade.email()) {
                <p class="text-sm text-stone-500">{{ facade.email() }}</p>
              }
            </div>
            <button type="button" class="btn-secondary-sm mt-4" (click)="startEdit()">
              Edit profile
            </button>
          }
        </div>
      </div>
    </section>
  `,
})
export class ProfileSummaryCardComponent {
  readonly facade = inject(UserProfileFacadeService);
  readonly editRequested = output<'preferences' | 'progress'>();

  readonly editing = signal(false);
  readonly nameControl = new FormControl('', { nonNullable: true });

  startEdit(): void {
    this.nameControl.setValue(this.facade.displayName());
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  async saveName(): Promise<void> {
    const success = await this.facade.saveDisplayName(this.nameControl.value);
    if (success) {
      this.editing.set(false);
    }
  }
}
