import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AllergySeverity } from '../../../../core/models/user-profile.model';
import { COMMON_ALLERGY_SUGGESTIONS } from '../../../../core/models/dietary-preference.constants';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';

@Component({
  selector: 'app-allergies-section',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="card border-amber-200 p-5 ring-1 ring-amber-100">
      <div class="flex items-start gap-2">
        <span class="text-lg" aria-hidden="true">⚠️</span>
        <div class="min-w-0 flex-1">
          <h2 class="section-title text-amber-900">Allergies &amp; intolerances</h2>
          <p class="mt-1 text-sm text-amber-900/80">
            Allergies will be treated as strict exclusions when suggesting recipes.
          </p>
        </div>
      </div>

      <form class="mt-4 space-y-3" [formGroup]="form" (ngSubmit)="add()">
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            class="input flex-1"
            placeholder="Allergy or intolerance…"
            formControlName="name"
            list="allergy-suggestions"
          />
          <datalist id="allergy-suggestions">
            @for (suggestion of suggestions; track suggestion) {
              <option [value]="suggestion"></option>
            }
          </datalist>
          <select class="input sm:w-36" formControlName="severity" aria-label="Severity">
            <option value="">Severity</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button type="submit" class="btn-primary-sm shrink-0">Add allergy</button>
        </div>
        <input
          type="text"
          class="input"
          placeholder="Notes (optional)"
          formControlName="notes"
          maxlength="500"
        />
      </form>

      @if (errorMessage()) {
        <p class="mt-2 text-sm text-red-600" role="alert">{{ errorMessage() }}</p>
      }

      @if (allergies().length > 0) {
        <ul class="mt-4 divide-y divide-amber-100 rounded-lg border border-amber-100">
          @for (allergy of allergies(); track allergy.id) {
            <li class="flex items-start justify-between gap-3 px-3 py-3">
              <div>
                <p class="font-medium text-stone-900">
                  {{ allergy.name }}
                  <span class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    Strict exclusion
                  </span>
                </p>
                @if (allergy.severity) {
                  <p class="text-xs text-stone-600">Severity: {{ allergy.severity }}</p>
                }
                @if (allergy.notes) {
                  <p class="text-xs text-stone-500">{{ allergy.notes }}</p>
                }
              </div>
              <button
                type="button"
                class="text-sm text-red-600 hover:underline"
                (click)="remove(allergy.id)"
              >
                Remove
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="mt-4 text-sm text-stone-500">No allergies listed.</p>
      }
    </section>
  `,
})
export class AllergiesSectionComponent {
  readonly facade = inject(UserProfileFacadeService);
  readonly suggestions = COMMON_ALLERGY_SUGGESTIONS;
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    severity: new FormControl<AllergySeverity | ''>('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });

  readonly allergies = computed(() => this.facade.profile()?.allergies ?? []);

  async add(): Promise<void> {
    const name = this.form.controls.name.value.trim();
    if (!name) {
      return;
    }
    this.errorMessage.set(null);
    const severity = this.form.controls.severity.value || null;
    const notes = this.form.controls.notes.value.trim() || null;
    const success = await this.facade.addAllergy({ name, severity, notes });
    if (!success) {
      this.errorMessage.set(this.facade.saveMessage() ?? 'Could not add allergy.');
    } else {
      this.form.reset({ name: '', severity: '', notes: '' });
    }
  }

  async remove(id: string): Promise<void> {
    await this.facade.removeAllergy(id);
  }
}
