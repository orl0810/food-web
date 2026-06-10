import { Component, computed, inject } from '@angular/core';
import { DIETARY_PREFERENCE_OPTIONS } from '../../../../core/models/dietary-preference.constants';
import { DietaryPreference } from '../../../../core/models/user-profile.model';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-preferences-step',
  standalone: true,
  imports: [OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout title="Do you follow any eating preference?">
      <div class="flex flex-wrap gap-2">
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
    </app-onboarding-step-layout>
  `,
})
export class OnboardingPreferencesStepComponent {
  private readonly facade = inject(OnboardingFacadeService);
  readonly options = DIETARY_PREFERENCE_OPTIONS.filter((o) => o.value !== 'flexitarian' && o.value !== 'gluten_free' && o.value !== 'dairy_free');

  readonly selected = computed(() => this.facade.state()?.dietaryPreferences ?? ['none']);

  isSelected(value: DietaryPreference): boolean {
    return this.selected().includes(value);
  }

  toggle(value: DietaryPreference): void {
    let current = [...this.selected()];
    if (value === 'none') {
      this.facade.updatePreferences(['none']);
      return;
    }
    current = current.filter((p) => p !== 'none');
    const index = current.indexOf(value);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }
    if (current.length === 0) {
      this.facade.updatePreferences(['none']);
      return;
    }
    this.facade.updatePreferences(current as DietaryPreference[]);
  }
}
