import { Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  MEAL_SLOT_OPTIONS,
  WEEKDAY_OPTIONS,
} from '../../../../core/models/dietary-preference.constants';
import { MealPlanningUserSettings, MealSlot } from '../../../../core/models/user-profile.model';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';

@Component({
  selector: 'app-meal-planning-settings-section',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="card p-5">
      <h2 class="section-title">Meal planning settings</h2>
      <p class="mt-1 text-sm text-stone-600">Defaults used when planning meals and recipes.</p>

      <form class="mt-4 space-y-5" [formGroup]="form" (ngSubmit)="save()">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Meals per day</span>
            <input type="number" class="input mt-1" formControlName="defaultMealsPerDay" min="1" max="6" />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Household size</span>
            <input type="number" class="input mt-1" formControlName="householdSize" min="1" max="20" />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Default portions per recipe</span>
            <input type="number" class="input mt-1" formControlName="defaultPortionsPerRecipe" min="1" max="20" />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-stone-700">Preferred units</span>
            <select class="input mt-1" formControlName="preferredUnits">
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </select>
          </label>
        </div>

        <div>
          <span class="text-sm font-medium text-stone-700">Enabled meal slots</span>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (slot of mealSlots; track slot.value) {
              <button
                type="button"
                class="filter-pill"
                [class.filter-pill-active]="isSlotEnabled(slot.value)"
                [class.filter-pill-inactive]="!isSlotEnabled(slot.value)"
                (click)="toggleSlot(slot.value)"
              >
                {{ slot.label }}
              </button>
            }
          </div>
        </div>

        <div>
          <span class="text-sm font-medium text-stone-700">Preferred cooking days</span>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (day of weekdays; track day) {
              <button
                type="button"
                class="filter-pill"
                [class.filter-pill-active]="isCookingDay(day)"
                [class.filter-pill-inactive]="!isCookingDay(day)"
                (click)="toggleCookingDay(day)"
              >
                {{ day.slice(0, 3) }}
              </button>
            }
          </div>
        </div>

        <label class="block">
          <span class="text-sm font-medium text-stone-700">Preferred shopping day</span>
          <select class="input mt-1" formControlName="preferredShoppingDay">
            <option value="">Not set</option>
            @for (day of weekdays; track day) {
              <option [value]="day">{{ day }}</option>
            }
          </select>
        </label>

        <label class="flex items-center gap-2">
          <input type="checkbox" formControlName="expiringItemsReminderEnabled" />
          <span class="text-sm text-stone-700">Remind me about expiring items</span>
        </label>

        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary-sm" [disabled]="facade.saving()">
            {{ facade.saving() ? 'Saving…' : 'Save settings' }}
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
      </form>
    </section>
  `,
})
export class MealPlanningSettingsSectionComponent {
  readonly facade = inject(UserProfileFacadeService);
  readonly mealSlots = MEAL_SLOT_OPTIONS;
  readonly weekdays = WEEKDAY_OPTIONS;

  readonly enabledSlots = signal<MealSlot[]>(['breakfast', 'lunch', 'dinner']);
  readonly cookingDays = signal<string[]>([]);

  readonly form = new FormGroup({
    defaultMealsPerDay: new FormControl(3, { nonNullable: true }),
    householdSize: new FormControl(2, { nonNullable: true }),
    defaultPortionsPerRecipe: new FormControl(4, { nonNullable: true }),
    preferredUnits: new FormControl<'metric' | 'imperial'>('metric', { nonNullable: true }),
    preferredShoppingDay: new FormControl('', { nonNullable: true }),
    expiringItemsReminderEnabled: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const settings = this.facade.profile()?.mealPlanningSettings;
      if (!settings) {
        return;
      }
      this.patchForm(settings);
    });
  }

  isSlotEnabled(slot: MealSlot): boolean {
    return this.enabledSlots().includes(slot);
  }

  toggleSlot(slot: MealSlot): void {
    this.enabledSlots.update((current) => {
      if (current.includes(slot)) {
        const next = current.filter((entry) => entry !== slot);
        return next.length > 0 ? next : current;
      }
      return [...current, slot];
    });
  }

  isCookingDay(day: string): boolean {
    return this.cookingDays().includes(day);
  }

  toggleCookingDay(day: string): void {
    this.cookingDays.update((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day]
    );
  }

  async save(): Promise<void> {
    const settings: Partial<MealPlanningUserSettings> = {
      ...this.form.getRawValue(),
      preferredShoppingDay: this.form.controls.preferredShoppingDay.value || null,
      enabledMealSlots: this.enabledSlots(),
      preferredCookingDays: this.cookingDays(),
    };
    await this.facade.saveSettings(settings);
  }

  private patchForm(settings: MealPlanningUserSettings): void {
    this.form.patchValue({
      defaultMealsPerDay: settings.defaultMealsPerDay,
      householdSize: settings.householdSize,
      defaultPortionsPerRecipe: settings.defaultPortionsPerRecipe,
      preferredUnits: settings.preferredUnits,
      preferredShoppingDay: settings.preferredShoppingDay ?? '',
      expiringItemsReminderEnabled: settings.expiringItemsReminderEnabled,
    });
    this.enabledSlots.set([...settings.enabledMealSlots]);
    this.cookingDays.set([...(settings.preferredCookingDays ?? [])]);
  }
}
