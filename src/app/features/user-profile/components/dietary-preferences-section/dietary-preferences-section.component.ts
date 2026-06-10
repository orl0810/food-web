import { Component, effect, inject, signal } from '@angular/core';
import { DietaryPreference } from '../../../../core/models/user-profile.model';
import { DIETARY_PREFERENCE_OPTIONS } from '../../../../core/models/dietary-preference.constants';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';

@Component({
  selector: 'app-dietary-preferences-section',
  standalone: true,
  template: `
    <section class="card p-5">
      <h2 class="section-title">Dietary preferences</h2>
      <p class="mt-1 text-sm text-stone-600">Select all that apply to personalize recipe suggestions.</p>

      <div class="mt-4 flex flex-wrap gap-2">
        @for (option of options; track option.value) {
          <button
            type="button"
            class="filter-pill"
            [class.filter-pill-active]="isSelected(option.value)"
            [class.filter-pill-inactive]="!isSelected(option.value)"
            [attr.aria-pressed]="isSelected(option.value)"
            (click)="toggle(option.value)"
          >
            <span aria-hidden="true">{{ option.icon }}</span>
            {{ option.label }}
          </button>
        }
      </div>

      <div class="mt-4 flex items-center gap-3">
        <button type="button" class="btn-primary-sm" [disabled]="facade.saving()" (click)="save()">
          {{ facade.saving() ? 'Saving…' : 'Save preferences' }}
        </button>
        @if (facade.saveMessage()) {
          <span
            class="text-sm"
            [class.text-brand-700]="facade.saveState() === 'saved'"
            [class.text-red-600]="facade.saveState() === 'error'"
          >
            {{ facade.saveMessage() }}
          </span>
        }
      </div>
    </section>
  `,
})
export class DietaryPreferencesSectionComponent {
  readonly facade = inject(UserProfileFacadeService);
  readonly options = DIETARY_PREFERENCE_OPTIONS;

  private readonly selectedSignal = signal<DietaryPreference[]>(['none']);

  constructor() {
    effect(() => {
      const prefs = this.facade.profile()?.dietaryPreferences;
      if (prefs) {
        this.selectedSignal.set([...prefs]);
      }
    });
  }

  isSelected(value: DietaryPreference): boolean {
    return this.selectedSignal().includes(value);
  }

  toggle(value: DietaryPreference): void {
    this.selectedSignal.update((current) => {
      if (value === 'none') {
        return ['none'];
      }

      const withoutNone = current.filter((entry) => entry !== 'none');
      if (withoutNone.includes(value)) {
        const next = withoutNone.filter((entry) => entry !== value);
        return next.length > 0 ? next : ['none'];
      }
      return [...withoutNone, value];
    });
  }

  async save(): Promise<void> {
    const success = await this.facade.saveDietaryPreferences(this.selectedSignal());
    if (success && this.facade.profile()) {
      this.selectedSignal.set([...this.facade.profile()!.dietaryPreferences]);
    }
  }
}
