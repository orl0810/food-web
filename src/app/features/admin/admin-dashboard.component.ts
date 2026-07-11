import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { AdminDateRangeFilterComponent } from './components/admin-date-range-filter/admin-date-range-filter.component';
import { AdminFunnelComponent } from './components/admin-funnel/admin-funnel.component';
import { AdminDateRangePreset } from './models/admin-analytics.model';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    AdminDateRangeFilterComponent,
    AdminFunnelComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    StatCardComponent,
  ],
  template: `
    <div class="page">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="page-title">Admin Dashboard</h1>
          <p class="page-subtitle">
            Monitor activation, engagement, meal planning, and product health.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn-secondary"
            [disabled]="analytics.loading()"
            (click)="refresh()"
          >
            Refresh
          </button>
          @if (analytics.lastUpdated()) {
            <p class="text-xs text-stone-500">
              Last updated {{ analytics.lastUpdated() | date: 'short' }}
            </p>
          }
        </div>
      </div>

      <div class="card">
        <app-admin-date-range-filter
          [selected]="analytics.dateRange().preset"
          (presetChange)="onPresetChange($event)"
        />
      </div>

      @if (analytics.unavailable()) {
        <app-empty-state
          title="Analytics require Supabase"
          description="Admin analytics are available in production Supabase mode. Local development still supports the admin route and role checks."
        />
      } @else if (analytics.loading() && !analytics.data()) {
        <app-loading-state message="Loading admin analytics..." />
      } @else if (analytics.error()) {
        <div class="space-y-3">
          <p class="alert-error">{{ analytics.error() }}</p>
          <button type="button" class="btn-secondary" (click)="refresh()">Retry</button>
        </div>
      } @else if (!analytics.data()) {
        <app-empty-state
          title="No analytics data yet"
          description="Metrics will appear once users start registering and using core features."
          actionLabel="Refresh"
          (actionClick)="refresh()"
        />
      } @else {
        @let data = analytics.data()!;

        <section class="space-y-3">
          <h2 class="section-title">User overview</h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <app-stat-card
              layout="stacked"
              label="Total users"
              [value]="data.users.totalUsers"
              subtitle="Lifetime registered users"
            />
            <app-stat-card
              layout="stacked"
              label="New users"
              [value]="data.users.newUsers"
              subtitle="Registered in selected period"
            />
            <app-stat-card
              layout="stacked"
              label="Weekly active users"
              [value]="data.engagement.weeklyActiveUsers"
              subtitle="Meaningful actions in last 7 days"
            />
            <app-stat-card
              layout="stacked"
              label="Activated users"
              [value]="data.users.activatedUsers"
              subtitle="Onboarding complete + first meal eaten (cohort)"
            />
            <app-stat-card
              layout="stacked"
              label="Activation rate"
              [value]="formatPercent(data.users.activationRate)"
              subtitle="Activated / new users in period"
            />
          </div>
        </section>

        <section class="card space-y-4">
          <h2 class="section-title">Activation funnel</h2>
          <app-admin-funnel [funnel]="data.funnel" />
          <p class="text-sm text-stone-600">
            Overall activation:
            <span class="font-semibold text-stone-900">
              {{ formatPercent(data.users.activationRate) }}
            </span>
          </p>
        </section>

        <section class="space-y-3">
          <h2 class="section-title">Meal-planning performance</h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <app-stat-card
              layout="stacked"
              label="Planning days"
              [value]="data.mealPlans.totalMealPlans"
              subtitle="Distinct user-days with planned meals"
            />
            <app-stat-card
              layout="stacked"
              label="Planned meals"
              [value]="data.mealPlans.plannedMeals"
              subtitle="Status: planned"
            />
            <app-stat-card
              layout="stacked"
              label="Cooked meals"
              [value]="data.mealPlans.cookedMeals"
              subtitle="Status: prepared"
            />
            <app-stat-card
              layout="stacked"
              label="Completed meals"
              [value]="data.mealPlans.completedMeals"
              subtitle="Status: eaten"
            />
            <app-stat-card
              layout="stacked"
              label="Meal completion rate"
              [value]="formatPercent(data.mealPlans.mealCompletionRate)"
              subtitle="Eaten / planned + prepared + eaten"
            />
            <app-stat-card
              layout="stacked"
              label="Avg completed / active user"
              [value]="formatDecimal(data.mealPlans.averageCompletedMealsPerActiveUser)"
              subtitle="Active users in selected period"
            />
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="section-title">Product usage</h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <app-stat-card
              layout="stacked"
              label="Recipes created"
              [value]="data.productUsage.recipesCreated"
              subtitle="User recipes in period"
            />
            <app-stat-card
              layout="stacked"
              label="Recipe creators"
              [value]="data.productUsage.recipeCreators"
              subtitle="Unique users"
            />
            <app-stat-card
              layout="stacked"
              label="Inventory items added"
              [value]="data.productUsage.inventoryItemsAdded"
              subtitle="Food items created"
            />
            <app-stat-card
              layout="stacked"
              label="Shopping lists generated"
              [value]="data.productUsage.shoppingListsGenerated"
              subtitle="Distinct user-days (meal_plan source)"
            />
            <app-stat-card
              layout="stacked"
              label="Prepared portions"
              [value]="data.productUsage.preparedPortionsCreated"
              subtitle="Created in period"
            />
            <app-stat-card
              layout="stacked"
              label="Portions consumed"
              [value]="formatNullableNumber(data.productUsage.preparedPortionsConsumed)"
              subtitle="Total - available portions"
            />
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="section-title">Retention and engagement</h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <app-stat-card
              layout="stacked"
              label="Daily active users"
              [value]="data.engagement.dailyActiveUsers"
              subtitle="Last 24 hours"
            />
            <app-stat-card
              layout="stacked"
              label="Monthly active users"
              [value]="data.engagement.monthlyActiveUsers"
              subtitle="Last 30 days"
            />
            <app-stat-card
              layout="stacked"
              label="Returning users"
              [value]="data.engagement.returningUsers"
              subtitle="Active in period with prior activity"
            />
            <app-stat-card
              layout="stacked"
              label="Consecutive week users"
              [value]="data.engagement.consecutiveWeekUsers"
              subtitle="Active two weeks in a row"
            />
            <app-stat-card
              layout="stacked"
              label="Day-7 retention"
              [value]="formatRetention(data.engagement.daySevenRetentionRate)"
              subtitle="New users with activity days 1-7"
            />
            <app-stat-card
              layout="stacked"
              label="Week-4 retention"
              [value]="formatRetention(data.engagement.weekFourRetentionRate)"
              subtitle="New users with activity days 22-28"
            />
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="section-title">Friction and failures</h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <app-stat-card
              layout="stacked"
              variant="warning"
              icon="warning"
              label="Onboarding abandoned"
              [value]="data.friction.onboardingAbandoned"
              subtitle="In progress > 48 hours"
            />
            <app-stat-card
              layout="stacked"
              variant="warning"
              label="No meaningful action"
              [value]="data.users.usersWithNoMeaningfulAction"
              subtitle="Registered, never used core features"
            />
            <app-stat-card
              layout="stacked"
              variant="warning"
              label="No meal plan after onboarding"
              [value]="data.friction.usersWithoutMealPlanAfterOnboarding"
              subtitle="Completed onboarding only"
            />
            <app-stat-card
              layout="stacked"
              variant="danger"
              label="AI recipe failures"
              [value]="data.friction.mealPlanGenerationFailures"
              subtitle="ai_recipe_generation_failed events"
            />
            <app-stat-card
              layout="stacked"
              variant="danger"
              label="Recipe import failures"
              [value]="data.friction.recipeImportFailures"
              subtitle="AI recipe generation workflow"
            />
            <app-stat-card
              layout="stacked"
              label="Recipe import completion"
              [value]="formatRetention(data.friction.recipeImportCompletionRate)"
              subtitle="Completed / started"
            />
            <app-stat-card
              layout="stacked"
              variant="danger"
              label="Critical workflow failures"
              [value]="data.friction.criticalWorkflowFailures"
              subtitle="Tracked product events"
            />
            <app-stat-card
              layout="stacked"
              variant="danger"
              label="Meal photo failures"
              [value]="data.friction.mealPhotoAnalysisFailures"
              subtitle="From meal_photo_analyses"
            />
          </div>
        </section>
      }
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  readonly analytics = inject(AdminAnalyticsService);

  ngOnInit(): void {
    void this.analytics.load();
  }

  onPresetChange(preset: AdminDateRangePreset): void {
    this.analytics.setDateRangePreset(preset);
    void this.analytics.load();
  }

  refresh(): void {
    void this.analytics.load();
  }

  formatPercent(value: number): string {
    return `${value}%`;
  }

  formatRetention(value: number | null): string {
    if (value === null) {
      return 'Not enough data yet';
    }
    return `${value}%`;
  }

  formatDecimal(value: number): string {
    return value.toFixed(1);
  }

  formatNullableNumber(value: number | null): string {
    if (value === null) {
      return '—';
    }
    return String(value);
  }
}
