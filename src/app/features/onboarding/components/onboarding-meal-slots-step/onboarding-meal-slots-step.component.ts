import { Component, computed, inject } from '@angular/core';
import { MEAL_SLOT_OPTIONS } from '../../../../core/models/dietary-preference.constants';
import { PLANNING_DAY_OPTIONS } from '../../models/onboarding.constants';
import { MealSlotType } from '../../models/onboarding.model';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-meal-slots-step',
  standalone: true,
  imports: [OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout title="Which meals do you want to plan?">
      <div class="space-y-6">
        <div>
          <p class="text-sm font-medium text-stone-700">Meal slots</p>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (slot of mealSlots; track slot.value) {
              <button
                type="button"
                class="filter-pill"
                [class.filter-pill-active]="isSlotSelected(slot.value)"
                [class.filter-pill-inactive]="!isSlotSelected(slot.value)"
                (click)="toggleSlot(slot.value)"
              >
                {{ slot.label }}
              </button>
            }
          </div>
        </div>

        <div>
          <p class="text-sm font-medium text-stone-700">How many days do you want to plan?</p>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (days of dayOptions; track days) {
              <button
                type="button"
                class="filter-pill"
                [class.filter-pill-active]="planningDays() === days"
                [class.filter-pill-inactive]="planningDays() !== days"
                (click)="setDays(days)"
              >
                {{ days }} days
              </button>
            }
          </div>
        </div>
      </div>
    </app-onboarding-step-layout>
  `,
})
export class OnboardingMealSlotsStepComponent {
  private readonly facade = inject(OnboardingFacadeService);
  readonly mealSlots = MEAL_SLOT_OPTIONS;
  readonly dayOptions = PLANNING_DAY_OPTIONS;

  readonly selectedSlots = computed(() => this.facade.state()?.selectedMealSlots ?? []);
  readonly planningDays = computed(() => this.facade.state()?.planningDays ?? 5);

  isSlotSelected(slot: MealSlotType): boolean {
    return this.selectedSlots().includes(slot);
  }

  toggleSlot(slot: MealSlotType): void {
    const current = [...this.selectedSlots()];
    const index = current.indexOf(slot);
    if (index >= 0) {
      if (current.length > 1) current.splice(index, 1);
    } else {
      current.push(slot);
    }
    this.facade.updateMealSlots(current, this.planningDays());
  }

  setDays(days: number): void {
    this.facade.updateMealSlots(this.selectedSlots(), days);
  }
}
