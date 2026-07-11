import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { AdminAnalyticsFunnel } from '../../models/admin-analytics.model';

interface FunnelStage {
  label: string;
  count: number;
  conversionFromPrevious: number | null;
}

@Component({
  selector: 'app-admin-funnel',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="space-y-4">
      @for (stage of stages(); track stage.label; let index = $index) {
        <div>
          <div class="mb-1 flex items-center justify-between gap-3 text-sm">
            <span class="font-medium text-stone-800">{{ stage.label }}</span>
            <span class="text-stone-600">
              {{ stage.count | number }}
              @if (stage.conversionFromPrevious !== null) {
                <span class="text-stone-500">({{ stage.conversionFromPrevious }}%)</span>
              }
            </span>
          </div>
          <div
            class="h-2 overflow-hidden rounded-full bg-stone-100"
            role="progressbar"
            [attr.aria-valuenow]="stage.count"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="maxCount()"
            [attr.aria-label]="stage.label"
          >
            <div
              class="h-full rounded-full bg-brand-500 transition-all"
              [style.width.%]="barWidth(stage.count)"
            ></div>
          </div>
          @if (index < stages().length - 1) {
            <p class="mt-1 text-xs text-stone-500" aria-hidden="true">↓</p>
          }
        </div>
      }
      <p class="text-xs text-stone-500">
        Cohort users registered in the selected period. Conversion % is stage-over-stage within the funnel.
      </p>
    </div>
  `,
})
export class AdminFunnelComponent {
  readonly funnel = input.required<AdminAnalyticsFunnel>();

  readonly maxCount = computed(() => {
    const data = this.funnel();
    return Math.max(data.registered, 1);
  });

  readonly stages = computed<FunnelStage[]>(() => {
    const data = this.funnel();
    const registered = data.registered;
    const onboarding = data.onboardingCompleted;
    const firstPlan = data.firstMealPlan;
    const firstEaten = data.firstMealEaten;

    const pct = (numerator: number, denominator: number): number | null => {
      if (denominator <= 0) {
        return null;
      }
      return Math.round((numerator / denominator) * 100);
    };

    return [
      {
        label: 'Registered',
        count: registered,
        conversionFromPrevious: null,
      },
      {
        label: 'Onboarding completed',
        count: onboarding,
        conversionFromPrevious: pct(onboarding, registered),
      },
      {
        label: 'First meal plan created',
        count: firstPlan,
        conversionFromPrevious: pct(firstPlan, onboarding),
      },
      {
        label: 'First meal completed',
        count: firstEaten,
        conversionFromPrevious: pct(firstEaten, firstPlan),
      },
    ];
  });

  barWidth(count: number): number {
    return Math.min(100, Math.round((count / this.maxCount()) * 100));
  }
}
