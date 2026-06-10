import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';

@Component({
  selector: 'app-disliked-ingredients-section',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="card p-5">
      <h2 class="section-title">Disliked ingredients</h2>
      <p class="mt-1 text-sm text-stone-600">
        We'll avoid or de-prioritize recipes with these ingredients.
      </p>

      <div class="mt-4 flex gap-2">
        <input
          type="text"
          class="input flex-1"
          placeholder="Add an ingredient to avoid…"
          [formControl]="inputControl"
          (keydown.enter)="add($event)"
        />
        <button type="button" class="btn-primary-sm shrink-0" (click)="add()">Add</button>
      </div>

      @if (errorMessage()) {
        <p class="mt-2 text-sm text-red-600" role="alert">{{ errorMessage() }}</p>
      }

      @if (disliked().length > 0) {
        <div class="mt-4 flex flex-wrap gap-2">
          @for (item of disliked(); track item.id) {
            <span class="tag inline-flex items-center gap-1 bg-stone-100">
              {{ item.ingredientName }}
              <button
                type="button"
                class="ml-1 text-stone-500 hover:text-red-600"
                [attr.aria-label]="'Remove ' + item.ingredientName"
                (click)="remove(item.id)"
              >
                ×
              </button>
            </span>
          }
        </div>
      } @else {
        <p class="mt-4 text-sm text-stone-500">No disliked ingredients listed.</p>
      }
    </section>
  `,
})
export class DislikedIngredientsSectionComponent {
  readonly facade = inject(UserProfileFacadeService);
  readonly inputControl = new FormControl('', { nonNullable: true });
  readonly errorMessage = signal<string | null>(null);

  readonly disliked = computed(() => this.facade.profile()?.dislikedIngredients ?? []);

  async add(event?: Event): Promise<void> {
    event?.preventDefault();
    const name = this.inputControl.value.trim();
    if (!name) {
      return;
    }
    this.errorMessage.set(null);
    const success = await this.facade.addIngredient('disliked', { ingredientName: name });
    if (!success) {
      this.errorMessage.set(this.facade.saveMessage() ?? 'Could not add ingredient.');
    } else {
      this.inputControl.setValue('');
    }
  }

  async remove(id: string): Promise<void> {
    await this.facade.removeIngredient('disliked', id);
  }
}
