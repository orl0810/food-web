import { Component, inject } from '@angular/core';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';

@Component({
  selector: 'app-meal-planning-progress-section',
  standalone: true,
  imports: [StatCardComponent],
  template: `
    <section class="card p-5">
      <h2 class="section-title">Meal planning progress</h2>
      <p class="mt-1 text-sm text-stone-600">How consistent you've been with planning and completing meals.</p>

      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <app-stat-card
          label="Meals planned"
          icon="basket"
          layout="stacked"
          [value]="stats()?.mealsPlannedThisWeek ?? 0"
          subtitle="This week"
        />
        <app-stat-card
          label="Meals completed"
          icon="clock"
          variant="success"
          layout="stacked"
          [value]="stats()?.mealsCompletedThisWeek ?? 0"
          subtitle="This week"
        />
        <app-stat-card
          label="Ready portions used"
          icon="pantry"
          layout="stacked"
          [value]="stats()?.preparedPortionsUsedThisWeek ?? 0"
          subtitle="This week"
        />
        <app-stat-card
          label="Weekly completion"
          icon="clock"
          variant="warning"
          layout="stacked"
          [value]="(stats()?.weeklyCompletionPercentage ?? 0) + '%'"
        />
        <app-stat-card
          label="Planning streak"
          icon="basket"
          variant="success"
          layout="stacked"
          [value]="stats()?.completedWeeksStreak ?? 0"
          unit="weeks"
        />
        <app-stat-card
          label="Saved from waste"
          icon="warning"
          layout="stacked"
          [value]="stats()?.inventoryItemsSavedFromWasteThisWeek ?? 0"
          subtitle="Expiring items used"
        />
      </div>

      @if ((stats()?.estimatedTimeSavedMinutes ?? 0) > 0) {
        <p class="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Estimated {{ stats()?.estimatedTimeSavedMinutes }} minutes saved from meal prep this week.
        </p>
      }
    </section>
  `,
})
export class MealPlanningProgressSectionComponent {
  readonly facade = inject(UserProfileFacadeService);
  readonly stats = this.facade.stats;
}
