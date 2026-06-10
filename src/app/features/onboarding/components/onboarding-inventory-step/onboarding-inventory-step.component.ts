import { Component, computed, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { COMMON_INVENTORY_CHIPS } from '../../models/onboarding.constants';
import { OnboardingInventoryInput } from '../../models/onboarding.model';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-inventory-step',
  standalone: true,
  imports: [ReactiveFormsModule, OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout
      title="What do you already have?"
      helper="Add a few ingredients and we'll try to use them first."
    >
      <div class="flex flex-wrap gap-2">
        @for (chip of chips; track chip) {
          <button
            type="button"
            class="filter-pill filter-pill-inactive"
            (click)="addChip(chip)"
          >
            + {{ chip }}
          </button>
        }
      </div>

      <div class="mt-4 flex gap-2">
        <input
          type="text"
          class="input flex-1"
          placeholder="Add ingredient…"
          [formControl]="inputControl"
          (keydown.enter)="addFromInput($event)"
        />
        <button type="button" class="btn-primary-sm" (click)="addFromInput()">Add</button>
      </div>

      @if (items().length > 0) {
        <div class="mt-4 flex flex-wrap gap-2">
          @for (item of items(); track item.name) {
            <span class="tag inline-flex items-center gap-1 bg-brand-50 text-brand-800">
              {{ item.name }}
              <button type="button" (click)="remove(item.name)">×</button>
            </span>
          }
        </div>
      }
    </app-onboarding-step-layout>
  `,
})
export class OnboardingInventoryStepComponent {
  private readonly facade = inject(OnboardingFacadeService);
  readonly chips = COMMON_INVENTORY_CHIPS;
  readonly inputControl = new FormControl('', { nonNullable: true });
  readonly items = computed(() => this.facade.state()?.availableInventoryItems ?? []);

  addChip(name: string): void {
    this.addItem({ name, location: 'pantry' });
  }

  addFromInput(event?: Event): void {
    event?.preventDefault();
    const name = this.inputControl.value.trim();
    if (!name) return;
    this.addItem({ name, location: 'pantry' });
    this.inputControl.reset();
  }

  remove(name: string): void {
    this.facade.updateInventory(this.items().filter((i) => i.name !== name));
  }

  private addItem(item: OnboardingInventoryInput): void {
    const exists = this.items().some(
      (i) => i.name.toLowerCase() === item.name.toLowerCase()
    );
    if (exists) return;
    this.facade.updateInventory([...this.items(), item]);
  }
}
