import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OnboardingService } from '../../../../core/services/onboarding.service';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';
import { ProfileSummaryCardComponent } from '../profile-summary-card/profile-summary-card.component';
import { DietaryPreferencesSectionComponent } from '../dietary-preferences-section/dietary-preferences-section.component';
import { FavoriteIngredientsSectionComponent } from '../favorite-ingredients-section/favorite-ingredients-section.component';
import { DislikedIngredientsSectionComponent } from '../disliked-ingredients-section/disliked-ingredients-section.component';
import { AllergiesSectionComponent } from '../allergies-section/allergies-section.component';
import { MealPlanningProgressSectionComponent } from '../meal-planning-progress-section/meal-planning-progress-section.component';
import { NutritionProfileSectionComponent } from '../nutrition-profile-section/nutrition-profile-section.component';

type ProfileSection = 'summary' | 'preferences' | 'nutrition' | 'progress';

@Component({
  selector: 'app-user-profile-page',
  standalone: true,
  imports: [
    LoadingStateComponent,
    ProfileSummaryCardComponent,
    DietaryPreferencesSectionComponent,
    FavoriteIngredientsSectionComponent,
    DislikedIngredientsSectionComponent,
    AllergiesSectionComponent,
    MealPlanningProgressSectionComponent,
    NutritionProfileSectionComponent,
  ],
  template: `
    <div class="page">
      <div>
        <h1 class="page-title">Your Food Profile</h1>
        <p class="page-subtitle">Personalize how PantryFlow plans meals and suggests recipes.</p>
      </div>

      <nav class="sticky top-0 z-10 -mx-1 flex gap-2 overflow-x-auto bg-surface/95 px-1 py-2 backdrop-blur-sm">
        @for (section of sections; track section.id) {
          <button
            type="button"
            class="filter-pill shrink-0"
            [class.filter-pill-active]="activeSection() === section.id"
            [class.filter-pill-inactive]="activeSection() !== section.id"
            (click)="scrollToSection(section.id)"
          >
            {{ section.label }}
          </button>
        }
      </nav>

      @if (facade.loading() && !facade.profile()) {
        <app-loading-state message="Loading your profile..." />
      } @else {
        <div class="space-y-4">
          <div id="section-summary">
            <app-profile-summary-card />
          </div>

          <div id="section-preferences" class="flex flex-col gap-6">
            <app-dietary-preferences-section />
            <app-favorite-ingredients-section />
            <app-disliked-ingredients-section />
            <app-allergies-section />
          </div>

          <div id="section-nutrition">
            <app-nutrition-profile-section />
          </div>

          <div id="section-progress">
            <app-meal-planning-progress-section />
          </div>

          <section class="card flex flex-wrap gap-3 p-5">
            <button type="button" class="btn-primary-sm" (click)="restartOnboarding()">
              Create a new starter plan
            </button>
            <button type="button" class="btn-secondary-sm" (click)="exportProfile()">
              Export preferences
            </button>
            <button type="button" class="btn-secondary-sm text-red-600" (click)="resetProfile()">
              Reset preferences
            </button>
          </section>
        </div>
      }
    </div>
  `,
})
export class UserProfilePageComponent implements OnInit {
  readonly facade = inject(UserProfileFacadeService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeSection = signal<ProfileSection>('summary');

  readonly sections: { id: ProfileSection; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'progress', label: 'Progress' },
  ];

  ngOnInit(): void {
    void this.facade.loadAll().then(() => {
      const section = this.route.snapshot.queryParamMap.get('section') as ProfileSection | null;
      if (section && this.sections.some((entry) => entry.id === section)) {
        this.scrollToSection(section);
      }
    });
  }

  scrollToSection(section: ProfileSection): void {
    this.activeSection.set(section);
    document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  exportProfile(): void {
    this.facade.exportProfile();
  }

  async resetProfile(): Promise<void> {
    if (!confirm('Reset all food preferences to defaults? This cannot be undone.')) {
      return;
    }
    await this.facade.resetPreferences();
    await this.facade.loadAll();
  }

  async restartOnboarding(): Promise<void> {
    const proceed = confirm(
      'Start a new starter meal plan? Your current week\'s plan will not be removed automatically.'
    );
    if (!proceed) return;
    await this.onboardingService.restart();
    await this.router.navigateByUrl('/onboarding?restart=true');
  }
}
