import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ActivityLevel,
  NutritionGoal,
  NutritionSex,
} from '../../../../core/models/nutrition.model';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';

const ACTIVITY_LEVEL_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly active' },
  { value: 'moderately_active', label: 'Moderately active' },
  { value: 'very_active', label: 'Very active' },
  { value: 'athlete', label: 'Athlete' },
];

const NUTRITION_GOAL_OPTIONS: { value: NutritionGoal; label: string }[] = [
  { value: 'general_health', label: 'General health' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'fat_loss', label: 'Fat loss' },
  { value: 'muscle_gain', label: 'Muscle gain' },
];

@Component({
  selector: 'app-nutrition-profile-section',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="card p-5">
      <h2 class="section-title">Nutrition profile</h2>
      <p class="mt-1 text-sm text-stone-600">
        These details help estimate your daily protein, fiber, carbs, fats, and sugar targets.
        This is guidance only, not medical advice.
      </p>

      <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="save()">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-sm font-medium text-stone-700">
              Weight ({{ weightUnitLabel() }})
            </span>
            <input
              type="number"
              formControlName="weight"
              class="input w-full"
              [attr.min]="weightMin()"
              step="0.1"
              inputmode="decimal"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-sm font-medium text-stone-700">
              Height ({{ heightUnitLabel() }})
            </span>
            <input
              type="number"
              formControlName="height"
              class="input w-full"
              [attr.min]="heightMin()"
              step="0.1"
              inputmode="decimal"
            />
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-sm font-medium text-stone-700">Age (optional)</span>
            <input
              type="number"
              formControlName="age"
              class="input w-full"
              min="13"
              max="120"
              inputmode="numeric"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-sm font-medium text-stone-700">Sex (optional)</span>
            <select formControlName="sex" class="input w-full">
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
        </div>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-stone-700">Activity level</span>
          <select formControlName="activityLevel" class="input w-full">
            <option value="" disabled>Select activity level</option>
            @for (option of activityLevelOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-stone-700">Goal</span>
          <select formControlName="nutritionGoal" class="input w-full">
            <option value="" disabled>Select goal</option>
            @for (option of nutritionGoalOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>

        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary-sm" [disabled]="form.invalid || facade.saving()">
            {{ facade.saving() ? 'Saving…' : 'Save nutrition profile' }}
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
export class NutritionProfileSectionComponent {
  readonly facade = inject(UserProfileFacadeService);
  readonly activityLevelOptions = ACTIVITY_LEVEL_OPTIONS;
  readonly nutritionGoalOptions = NUTRITION_GOAL_OPTIONS;

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    weight: this.fb.control<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    height: this.fb.control<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    age: this.fb.control<number | null>(null, {
      validators: [Validators.min(13), Validators.max(120)],
    }),
    sex: this.fb.control<NutritionSex | null>(null),
    activityLevel: this.fb.control<ActivityLevel | null>(null, Validators.required),
    nutritionGoal: this.fb.control<NutritionGoal | null>(null, Validators.required),
  });

  constructor() {
    effect(() => {
      const profile = this.facade.profile();
      if (!profile) {
        return;
      }

      const metric = profile.mealPlanningSettings.preferredUnits === 'metric';
      this.form.patchValue(
        {
          weight: this.fromStoredWeight(profile.weightKg, metric),
          height: this.fromStoredHeight(profile.heightCm, metric),
          age: profile.age ?? null,
          sex: profile.sex ?? null,
          activityLevel: profile.activityLevel ?? null,
          nutritionGoal: profile.nutritionGoal ?? null,
        },
        { emitEvent: false }
      );
    });
  }

  weightUnitLabel(): string {
    return this.isMetric() ? 'kg' : 'lb';
  }

  heightUnitLabel(): string {
    return this.isMetric() ? 'cm' : 'in';
  }

  weightMin(): number {
    return this.isMetric() ? 20 : 44;
  }

  heightMin(): number {
    return this.isMetric() ? 100 : 39;
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    const metric = this.isMetric();
    const value = this.form.getRawValue();

    await this.facade.saveNutritionProfile({
      weightKg: this.toStoredWeight(value.weight, metric),
      heightCm: this.toStoredHeight(value.height, metric),
      age: value.age ?? null,
      sex: value.sex || null,
      activityLevel: value.activityLevel,
      nutritionGoal: value.nutritionGoal,
    });
  }

  private isMetric(): boolean {
    return this.facade.profile()?.mealPlanningSettings.preferredUnits !== 'imperial';
  }

  private fromStoredWeight(weightKg: number | null | undefined, metric: boolean): number | null {
    if (!weightKg) {
      return null;
    }
    return metric ? weightKg : Math.round(weightKg * 2.20462 * 10) / 10;
  }

  private toStoredWeight(weight: number | null, metric: boolean): number | null {
    if (!weight) {
      return null;
    }
    return metric ? weight : Math.round((weight / 2.20462) * 10) / 10;
  }

  private fromStoredHeight(heightCm: number | null | undefined, metric: boolean): number | null {
    if (!heightCm) {
      return null;
    }
    return metric ? heightCm : Math.round((heightCm / 2.54) * 10) / 10;
  }

  private toStoredHeight(height: number | null, metric: boolean): number | null {
    if (!height) {
      return null;
    }
    return metric ? height : Math.round(height * 2.54 * 10) / 10;
  }
}
