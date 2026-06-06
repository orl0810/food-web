import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MealPlanEntry,
  MealType,
} from '../../../core/models/meal-plan.model';
import { MealPlanService } from '../../../core/services/meal-plan.service';

@Component({
  selector: 'app-todays-meal-plan',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <section class="card overflow-hidden">
      <div class="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
        <h2 class="section-title">Today&apos;s Meal Plan</h2>
        @if (showEditLink()) {
          <a
            routerLink="/meal-plan"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:border-brand-200 hover:bg-brand-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Edit plan
          </a>
        }
      </div>

      <div class="divide-y divide-stone-100">
        @for (mealType of mealTypes; track mealType) {
          @if (todayMealEntry(mealType); as entry) {
            <a
              [routerLink]="['/recipes', entry.recipe_id]"
              class="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-stone-50 sm:gap-4 sm:px-5"
            >
              <div
                class="h-14 w-14 shrink-0 rounded-full bg-stone-100 ring-1 ring-stone-200/80"
                aria-hidden="true"
              ></div>

              <div class="min-w-0 flex-1">
                <p class="text-xs font-semibold text-brand-700">{{ mealTypeLabel(mealType) }}</p>
                <p class="mt-0.5 truncate font-semibold text-stone-900">{{ entry.recipe?.title }}</p>
                @if (entry.recipe?.description) {
                  <p class="mt-0.5 line-clamp-1 text-sm text-stone-500">{{ entry.recipe?.description }}</p>
                }
              </div>

              @if (entry.recipe?.tags?.length) {
                <div class="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
                  @for (tag of entry.recipe!.tags!.slice(0, 3); track tag) {
                    <span class="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                      {{ tag }}
                    </span>
                  }
                </div>
              }

              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5 shrink-0 text-stone-300" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </a>
          } @else {
            @if (emptySlotMode() === 'navigate') {
              <a
                routerLink="/meal-plan"
                class="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-brand-50/40 sm:gap-4 sm:px-5"
              >
                <ng-container *ngTemplateOutlet="emptySlotContent; context: { mealType }" />
              </a>
            } @else {
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-brand-50/40 sm:gap-4 sm:px-5"
                (click)="onEmptySlotClick(mealType)"
              >
                <ng-container *ngTemplateOutlet="emptySlotContent; context: { mealType }" />
              </button>
            }
          }
        }
      </div>

      @if (showEmptyDayCta() && hasNoTodayMeals()) {
        <div class="mx-4 mb-4 mt-1 flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/60 px-4 py-5 sm:mx-5 sm:flex-row sm:justify-between">
          <div class="flex items-center gap-3 text-center sm:text-left">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-8 w-8 shrink-0 text-stone-300" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75M9.75 4.5h4.5M6 9.75h12M6 9.75v7.125c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
            <p class="text-sm text-stone-600">No plan? Start with expiring ingredients.</p>
          </div>
          @if (emptySlotMode() === 'navigate') {
            <a
              routerLink="/meal-plan"
              class="btn-primary shrink-0"
            >
              Plan today&apos;s meals
            </a>
          } @else {
            <button
              type="button"
              class="btn-primary shrink-0"
              (click)="planTodayClick.emit()"
            >
              Plan today&apos;s meals
            </button>
          }
        </div>
      }
    </section>

    <ng-template #emptySlotContent let-mealType="mealType">
      <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-100">
        @switch (mealType) {
          @case ('breakfast') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 text-brand-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.75M9.75 4.5h4.5M6 9.75h12M6 9.75v7.125c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.75M6 9.75V6.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125V9.75" />
            </svg>
          }
          @case ('lunch') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 text-brand-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          }
          @case ('dinner') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 text-brand-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.38a48.474 48.474 0 0 0-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12" />
            </svg>
          }
          @case ('snack') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 text-brand-600">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c-2 2-2.5 3.5-2.5 5 0 1.8 1 3.2 2.2 4.2-.7 1-1.2 2.3-1.2 3.8 0 2.8 2.2 5 5 5s5-2.2 5-5c0-1.5-.5-2.8-1.2-3.8 1.2-1 2.2-2.4 2.2-4.2 0-1.5-.5-3-2.5-5" />
              <path stroke-linecap="round" d="M12 3v1.5" />
            </svg>
          }
        }
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-brand-700">{{ mealTypeLabel(mealType) }}</p>
        <p class="mt-0.5 text-sm text-stone-500">No meal planned yet</p>
        <p class="mt-0.5 text-sm font-medium text-brand-700">Tap to add one</p>
      </div>

      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5 shrink-0 text-stone-300" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </ng-template>
  `,
})
export class TodaysMealPlanComponent {
  private readonly mealPlanService = inject(MealPlanService);

  readonly showEditLink = input(true);
  readonly showEmptyDayCta = input(true);
  readonly emptySlotMode = input<'navigate' | 'picker'>('navigate');

  readonly emptySlotClick = output<MealType>();
  readonly planTodayClick = output<void>();

  readonly mealTypes = MEAL_TYPES;

  readonly hasNoTodayMeals = computed(() =>
    this.mealTypes.every((mealType) => !this.mealPlanService.todaysMeals().has(mealType))
  );

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  todayMealEntry(mealType: MealType): MealPlanEntry | undefined {
    return this.mealPlanService.todaysMeals().get(mealType);
  }

  onEmptySlotClick(mealType: MealType): void {
    this.emptySlotClick.emit(mealType);
  }
}
