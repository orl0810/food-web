import { Component, computed, inject } from '@angular/core';
import { MEAL_SLOT_OPTIONS } from '../../../../core/models/dietary-preference.constants';
import { GeneratedOnboardingMealPlan } from '../../models/onboarding.model';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-review-plan-step',
  standalone: true,
  imports: [OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout
      title="Here's your first meal plan"
      subtitle="You can edit anything before saving."
    >
      @if (plan(); as currentPlan) {
        <div class="space-y-4">
          <div class="card p-4">
            <div class="flex flex-wrap gap-4 text-sm text-stone-600">
              <span>{{ currentPlan.summary.mealsPlanned }} meals planned</span>
              <span>{{ currentPlan.summary.cookingSessions }} cooking sessions</span>
              <span>{{ currentPlan.shoppingListItems.length }} shopping items</span>
            </div>
          </div>

          @for (day of currentPlan.days; track day.date) {
            <section class="card p-4">
              <h2 class="section-title">{{ day.dayName }}</h2>
              <div class="mt-3 space-y-3">
                @for (meal of day.meals; track meal.slot) {
                  <div class="rounded-lg bg-stone-50 p-3">
                    <p class="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {{ slotLabel(meal.slot) }}
                    </p>
                    @if (meal.items.length === 0) {
                      <p class="mt-1 text-sm text-stone-500">No meal</p>
                    } @else {
                      @for (item of meal.items; track item.name) {
                        <div class="mt-2 flex items-center justify-between gap-2">
                          <span class="text-sm font-medium text-stone-800">{{ item.name }}</span>
                          <button
                            type="button"
                            class="btn-danger text-xs"
                            (click)="removeItem(day.date, meal.slot, item.name)"
                          >
                            Remove
                          </button>
                        </div>
                      }
                    }
                  </div>
                }
              </div>
            </section>
          }

          @if (currentPlan.cookingSessions.length > 0) {
            <section class="card p-4">
              <h2 class="section-title">Cooking sessions</h2>
              <ul class="mt-2 space-y-2 text-sm text-stone-700">
                @for (session of currentPlan.cookingSessions; track session.date) {
                  <li>{{ session.title }} — {{ session.tasks[0]?.title }}</li>
                }
              </ul>
            </section>
          }

          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="btn-secondary"
              [disabled]="facade.isGenerating()"
              (click)="regenerate()"
            >
              Regenerate plan
            </button>
            <button
              type="button"
              class="btn-primary"
              [disabled]="facade.isConfirming()"
              (click)="confirm()"
            >
              {{ facade.isConfirming() ? 'Saving…' : 'Confirm plan' }}
            </button>
          </div>

          @if (facade.error(); as err) {
            <p class="text-sm text-red-600" role="alert">{{ err }}</p>
          }
        </div>
      }
    </app-onboarding-step-layout>
  `,
})
export class OnboardingReviewPlanStepComponent {
  readonly facade = inject(OnboardingFacadeService);
  readonly plan = computed(() => this.facade.generatedPlan());

  slotLabel(slot: string): string {
    return MEAL_SLOT_OPTIONS.find((o) => o.value === slot)?.label ?? slot;
  }

  removeItem(date: string, slot: string, itemName: string): void {
    const current = this.plan();
    if (!current) return;
    const updated = this.removeFromPlan(current, date, slot, itemName);
    this.facade.updateGeneratedPlan(updated);
  }

  regenerate(): void {
    void this.facade.regeneratePlan();
  }

  async confirm(): Promise<void> {
    await this.facade.confirmPlan();
  }

  private removeFromPlan(
    plan: GeneratedOnboardingMealPlan,
    date: string,
    slot: string,
    itemName: string
  ): GeneratedOnboardingMealPlan {
    const days = plan.days.map((day) => {
      if (day.date !== date) return day;
      return {
        ...day,
        meals: day.meals.map((meal) => {
          if (meal.slot !== slot) return meal;
          return {
            ...meal,
            items: meal.items.filter((i) => i.name !== itemName),
          };
        }),
      };
    });
    return {
      ...plan,
      days,
      summary: {
        ...plan.summary,
        mealsPlanned: days.reduce(
          (sum, day) => sum + day.meals.filter((m) => m.items.length > 0).length,
          0
        ),
      },
    };
  }
}
