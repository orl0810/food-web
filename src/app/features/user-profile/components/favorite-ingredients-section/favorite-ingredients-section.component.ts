import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { UserProfileFacadeService } from '../../services/user-profile-facade.service';

@Component({
  selector: 'app-favorite-ingredients-section',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="card p-5">
      <h2 class="section-title">Favorite ingredients</h2>
      <p class="mt-1 text-sm text-stone-600">
        Ingredients you love — we'll prioritize recipes that use them.
      </p>

      <div class="mt-4 flex gap-2">
        <input
          type="text"
          class="input flex-1"
          placeholder="Add an ingredient…"
          [formControl]="inputControl"
          (keydown.enter)="addManual($event)"
        />
        <button type="button" class="btn-primary-sm shrink-0" (click)="addManual()">Add</button>
      </div>

      @if (errorMessage()) {
        <p class="mt-2 text-sm text-red-600" role="alert">{{ errorMessage() }}</p>
      }

      @if (favorites().length > 0) {
        <div class="mt-4 flex flex-wrap gap-2">
          @for (item of favorites(); track item.id) {
            <span class="tag inline-flex items-center gap-1">
              {{ item.ingredientName }}
              @if (item.source === 'auto_detected') {
                <span class="text-[10px] text-stone-500">(auto)</span>
              }
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
        <p class="mt-4 text-sm text-stone-500">No favorites yet.</p>
      }

      @if (suggested().length > 0) {
        <div class="mt-5 rounded-xl bg-brand-50 p-4">
          <p class="text-sm font-medium text-brand-800">Suggested from your inventory</p>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (item of suggested(); track item.normalizedName) {
              <button
                type="button"
                class="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                (click)="addSuggested(item.name, item.category, item.usageCount)"
              >
                + {{ item.name }}
                <span class="text-brand-600/70">({{ item.usageCount }}×)</span>
              </button>
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class FavoriteIngredientsSectionComponent {
  readonly facade = inject(UserProfileFacadeService);
  readonly inputControl = new FormControl('', { nonNullable: true });
  readonly errorMessage = signal<string | null>(null);

  readonly favorites = computed(() => this.facade.profile()?.favoriteIngredients ?? []);
  readonly suggested = computed(() =>
    (this.facade.suggestedIngredients() ?? []).filter(
      (item) =>
        !this.favorites().some((favorite) => favorite.normalizedName === item.normalizedName)
    )
  );

  constructor() {
    effect(() => {
      this.facade.error();
      this.errorMessage.set(null);
    });
  }

  async addManual(event?: Event): Promise<void> {
    event?.preventDefault();
    const name = this.inputControl.value.trim();
    if (!name) {
      return;
    }
    this.errorMessage.set(null);
    const success = await this.facade.addIngredient('favorite', { ingredientName: name });
    if (!success) {
      this.errorMessage.set(this.facade.saveMessage() ?? this.facade.error() ?? 'Could not add ingredient.');
    } else {
      this.inputControl.setValue('');
    }
  }

  async addSuggested(name: string, category?: string | null, usageCount?: number): Promise<void> {
    this.errorMessage.set(null);
    const success = await this.facade.addIngredient('favorite', {
      ingredientName: name,
      category,
      source: 'auto_detected',
      usageCount,
    });
    if (!success) {
      this.errorMessage.set(this.facade.saveMessage() ?? 'Could not add ingredient.');
    }
  }

  async remove(id: string): Promise<void> {
    await this.facade.removeIngredient('favorite', id);
  }
}
