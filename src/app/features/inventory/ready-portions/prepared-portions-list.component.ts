import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import {
  PreparedPortion,
  PreparedPortionFilter,
  PreparedPortionInput,
  PREPARED_PORTION_FILTERS,
} from '../../../core/models/prepared-portion.model';
import { PreparedPortionService } from '../../../core/services/prepared-portion.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { PreparedPortionCardComponent } from './prepared-portion-card.component';
import { PreparedPortionFormComponent } from './prepared-portion-form.component';

@Component({
  selector: 'app-prepared-portions-list',
  standalone: true,
  imports: [
    PreparedPortionCardComponent,
    PreparedPortionFormComponent,
    EmptyStateComponent,
    LoadingStateComponent,
  ],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-stone-600">Cooked food you can reuse across meals.</p>
        @if (!showForm()) {
          <button type="button" class="btn-primary-sm" (click)="openAddForm()">
            Add prepared food
          </button>
        }
      </div>

      <div class="flex flex-wrap gap-2">
        @for (filter of filters; track filter.value) {
          <button
            type="button"
            class="filter-pill"
            [class.filter-pill-active]="activeFilter() === filter.value"
            [class.filter-pill-inactive]="activeFilter() !== filter.value"
            (click)="activeFilter.set(filter.value)"
          >
            {{ filter.label }}
          </button>
        }
      </div>

      @if (showForm()) {
        <app-prepared-portion-form
          [portion]="editingPortion()"
          [submitting]="saving()"
          [error]="formError()"
          (saved)="savePortion($event)"
          (cancelled)="closeForm()"
        />
      }

      @if (preparedPortionService.loading()) {
        <app-loading-state message="Loading ready portions..." />
      } @else if (preparedPortionService.error()) {
        <p class="alert-error">{{ preparedPortionService.error() }}</p>
      } @else if (filteredPortions().length === 0) {
        <app-empty-state
          title="No ready portions yet"
          description="Mark a recipe as cooked or add prepared food manually to track reusable portions."
          [actionLabel]="showForm() ? '' : 'Add prepared food'"
          (actionClick)="openAddForm()"
        />
      } @else {
        <div class="space-y-3">
          @for (portion of filteredPortions(); track portion.id) {
            <app-prepared-portion-card
              [portion]="portion"
              (addToMealPlan)="addToMealPlan.emit($event)"
              (edit)="openEditForm($event)"
              (markEaten)="onMarkEaten($event)"
              (freeze)="onFreeze($event)"
              (deletePortion)="onDelete($event)"
            />
          }
        </div>
      }
    </div>
  `,
})
export class PreparedPortionsListComponent implements OnInit {
  readonly preparedPortionService = inject(PreparedPortionService);

  readonly addToMealPlan = output<PreparedPortion>();

  readonly filters = PREPARED_PORTION_FILTERS;
  readonly activeFilter = signal<PreparedPortionFilter>('all');
  readonly showForm = signal(false);
  readonly editingPortion = signal<PreparedPortion | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly filteredPortions = computed(() =>
    this.preparedPortionService.filterPortions(
      this.preparedPortionService.portions(),
      this.activeFilter()
    )
  );

  ngOnInit(): void {
    void this.preparedPortionService.loadPortions();
  }

  openAddForm(): void {
    this.editingPortion.set(null);
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEditForm(portion: PreparedPortion): void {
    this.editingPortion.set(portion);
    this.formError.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingPortion.set(null);
    this.formError.set(null);
  }

  async savePortion(input: PreparedPortionInput): Promise<void> {
    this.saving.set(true);
    this.formError.set(null);

    const editing = this.editingPortion();
    if (editing) {
      const { error } = await this.preparedPortionService.updatePortion(editing.id, {
        ...input,
        total_portions: input.total_portions,
      });
      this.saving.set(false);
      if (error) {
        this.formError.set(error);
        return;
      }
    } else {
      const { error } = await this.preparedPortionService.createPortion(input);
      this.saving.set(false);
      if (error) {
        this.formError.set(error);
        return;
      }
    }

    this.closeForm();
  }

  async onMarkEaten(portion: PreparedPortion): Promise<void> {
    const countStr = window.prompt(
      `How many portions did you eat? (${portion.available_portions} available)`,
      '1'
    );
    if (!countStr) {
      return;
    }
    const count = Math.max(1, parseInt(countStr, 10) || 1);
    await this.preparedPortionService.markAsEaten(portion.id, count);
  }

  async onFreeze(portion: PreparedPortion): Promise<void> {
    await this.preparedPortionService.moveToFreezer(portion.id);
  }

  async onDelete(portion: PreparedPortion): Promise<void> {
    if (!window.confirm(`Delete "${portion.name}"? This cannot be undone.`)) {
      return;
    }
    await this.preparedPortionService.deletePortion(portion.id);
  }
}
