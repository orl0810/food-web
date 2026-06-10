import { Component, computed, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { COMMON_ALLERGY_SUGGESTIONS } from '../../../../core/models/dietary-preference.constants';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-avoidances-step',
  standalone: true,
  imports: [ReactiveFormsModule, OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout
      title="Any ingredients you want to avoid?"
      helper="Allergies will be strictly excluded from meal suggestions."
    >
      <div class="space-y-6">
        <section>
          <h2 class="section-title">Disliked ingredients</h2>
          <p class="mt-1 text-sm text-stone-500">Avoided when possible, but less strict than allergies.</p>
          <div class="mt-3 flex gap-2">
            <input
              type="text"
              class="input flex-1"
              placeholder="Add ingredient…"
              [formControl]="dislikeControl"
              (keydown.enter)="addDislike($event)"
            />
            <button type="button" class="btn-primary-sm" (click)="addDislike()">Add</button>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (item of disliked(); track item) {
              <span class="tag inline-flex items-center gap-1 bg-stone-100">
                {{ item }}
                <button type="button" class="text-stone-500 hover:text-red-600" (click)="removeDislike(item)">×</button>
              </span>
            }
          </div>
        </section>

        <section>
          <h2 class="section-title">Allergies or strict exclusions</h2>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (suggestion of allergySuggestions; track suggestion) {
              <button
                type="button"
                class="filter-pill filter-pill-inactive"
                (click)="addAllergy(suggestion)"
              >
                + {{ suggestion }}
              </button>
            }
          </div>
          <div class="mt-3 flex gap-2">
            <input
              type="text"
              class="input flex-1"
              placeholder="Add allergy…"
              [formControl]="allergyControl"
              (keydown.enter)="addAllergyFromInput($event)"
            />
            <button type="button" class="btn-primary-sm" (click)="addAllergyFromInput()">Add</button>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (item of allergies(); track item) {
              <span class="tag inline-flex items-center gap-1 bg-red-50 text-red-800">
                {{ item }}
                <button type="button" (click)="removeAllergy(item)">×</button>
              </span>
            }
          </div>
        </section>
      </div>
    </app-onboarding-step-layout>
  `,
})
export class OnboardingAvoidancesStepComponent {
  private readonly facade = inject(OnboardingFacadeService);
  readonly allergySuggestions = COMMON_ALLERGY_SUGGESTIONS;
  readonly dislikeControl = new FormControl('', { nonNullable: true });
  readonly allergyControl = new FormControl('', { nonNullable: true });

  readonly disliked = computed(() => this.facade.state()?.dislikedIngredients ?? []);
  readonly allergies = computed(() => this.facade.state()?.allergies ?? []);

  addDislike(event?: Event): void {
    event?.preventDefault();
    const name = this.dislikeControl.value.trim();
    if (!name) return;
    const next = [...new Set([...this.disliked(), name])];
    this.facade.updateAvoidances(next, this.allergies());
    this.dislikeControl.reset();
  }

  removeDislike(name: string): void {
    this.facade.updateAvoidances(
      this.disliked().filter((i) => i !== name),
      this.allergies()
    );
  }

  addAllergy(name: string): void {
    const next = [...new Set([...this.allergies(), name])];
    this.facade.updateAvoidances(this.disliked(), next);
  }

  addAllergyFromInput(event?: Event): void {
    event?.preventDefault();
    const name = this.allergyControl.value.trim();
    if (!name) return;
    this.addAllergy(name);
    this.allergyControl.reset();
  }

  removeAllergy(name: string): void {
    this.facade.updateAvoidances(
      this.disliked(),
      this.allergies().filter((i) => i !== name)
    );
  }
}
