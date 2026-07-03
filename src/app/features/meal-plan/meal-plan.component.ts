import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_TIME_RANGES,
  MealType,
} from '../../core/models/meal-plan.model';
import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { MealPlanService } from '../../core/services/meal-plan.service';
import { MealStreakService } from '../../core/services/meal-streak.service';
import { RecipeService } from '../../core/services/recipe.service';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import {
  formatDayShort,
  formatFullDayHeading,
  formatWeekRangeCompact,
  isPastDate,
  isToday,
  toISODate,
} from '../../shared/utils/meal-plan.utils';
import {
  getIngredientAvailability,
  IngredientAvailability,
} from '../../shared/utils/recipe-availability.utils';
import { ConfettiCelebrationComponent } from './components/confetti-celebration/confetti-celebration.component';
import { DailyProgressBarComponent } from './components/daily-progress-bar/daily-progress-bar.component';
import { MealSlotCompletionButtonComponent } from './components/meal-slot-completion-button/meal-slot-completion-button.component';
import { MealPlanProgressService } from './services/meal-plan-progress.service';
import { MealSlotItemsComponent } from './meal-slot-items.component';
import { MealSlotItemPickerComponent } from './meal-slot-item-picker.component';
import { getMealSlotItemDisplayName } from '../../shared/utils/prepared-portion.utils';
import {
  getDayProgressTitle,
  isSlotCompleted,
} from './utils/meal-slot-completion.utils';

interface SelectedSlot {
  date: string;
  mealType: MealType;
}

interface WeekStats {
  mealsPlanned: number;
  ingredientsReadyPercent: number | null;
  itemsNeeded: number;
}

@Component({
  selector: 'app-meal-plan',
  standalone: true,
  imports: [
    LoadingStateComponent,
    StatCardComponent,
    MealSlotItemsComponent,
    MealSlotItemPickerComponent,
    DailyProgressBarComponent,
    MealSlotCompletionButtonComponent,
    ConfettiCelebrationComponent,
  ],
  template: `
    <app-confetti-celebration [active]="showConfetti()" />

    <div class="page">
      <!-- <div>
        <h1 class="page-title">Meal Plan</h1>
        <p class="page-subtitle">Plan your week and reduce waste.</p>
      </div>-->

      <!-- Week navigation -->
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50"
          aria-label="Previous week"
          (click)="onPreviousWeek()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div class="min-w-0 text-center">
          <p class="text-base font-semibold text-stone-900">{{ weekRangeLabel() }}</p>
          @if (!isCurrentWeek()) {
            <button
              type="button"
              class="mt-0.5 text-xs font-medium text-brand-700 hover:text-brand-800"
              (click)="onTodayWeek()"
            >
              Jump to this week
            </button>
          }
        </div>

        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50"
          aria-label="Next week"
          (click)="onNextWeek()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <!-- Week day picker -->
      <div class="grid w-full grid-cols-7 gap-0.5 sm:gap-1">
        @for (date of mealPlanService.weekDates(); track date) {
          @let day = formatDayShort(date);
          @let mealCount = mealsForDate(date);
          <button
            type="button"
            class="flex w-full flex-col items-center rounded-lg px-0.5 py-2 transition-colors sm:rounded-xl sm:px-1 sm:py-2.5"
            [class.bg-brand-600]="selectedDate() === date"
            [class.text-white]="selectedDate() === date"
            [class.bg-stone-100]="selectedDate() !== date"
            [class.text-stone-700]="selectedDate() !== date"
            [class.ring-2]="isTodayDate(date) && selectedDate() !== date"
            [class.ring-brand-600]="isTodayDate(date) && selectedDate() !== date"
            [class.ring-offset-1]="isTodayDate(date) && selectedDate() !== date"
            [class.opacity-60]="isPastDate(date)"
            (click)="selectDate(date)"
          >
            <span class="text-[10px] font-medium sm:text-xs">{{ day.weekday }}</span>
            <span class="mt-0.5 text-base font-semibold leading-none sm:text-lg">{{ day.day }}</span>
            <span class="mt-1 flex h-1.5 items-center justify-center gap-0.5" aria-hidden="true">
              @for (dot of mealCountDots(mealCount); track $index) {
                <span
                  class="h-1 w-1 rounded-full"
                  [class.bg-white/80]="selectedDate() === date"
                  [class.bg-brand-600]="selectedDate() !== date"
                ></span>
              }
            </span>
          </button>
        }
      </div>

      @if (!mealPlanService.loading() && !mealPlanService.error()) {
        <!-- Week summary stats -->
        <div class="grid grid-cols-3 gap-2 sm:gap-4">
          <app-stat-card
            label="Meals planned"
            icon="basket"
            variant="success"
            layout="stacked"
            [value]="weekStats().mealsPlanned"
          />
          <app-stat-card
            label="Ingredients ready"
            icon="clock"
            variant="warning"
            layout="stacked"
            [value]="weekStats().ingredientsReadyPercent !== null ? weekStats().ingredientsReadyPercent! + '%' : '—'"
          />
          <app-stat-card
            label="Items needed"
            icon="warning"
            variant="danger"
            layout="stacked"
            [value]="weekStats().itemsNeeded"
          />
        </div>
      }

      @if (selectedSlot()) {
        <app-meal-slot-item-picker
          [date]="selectedSlot()!.date"
          [mealType]="selectedSlot()!.mealType"
          (added)="onItemAdded()"
          (cancelled)="selectedSlot.set(null)"
        />
      }

      @if (mealPlanService.loading()) {
        <app-loading-state message="Loading meal plan..." />
      } @else if (mealPlanService.error()) {
        <p class="alert-error">
          {{ mealPlanService.error() }}
        </p>
      } @else {
        <!-- Selected day meals -->
        <div>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-stone-900">{{ selectedDayHeading() }}</h2>
            @if (isTodayDate(selectedDate())) {
              <span class="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Today</span>
            }
          </div>

          <app-daily-progress-bar
            class="mb-5 block"
            [title]="dayProgressTitle()"
            [progress]="dayProgress()"
          />

          @if (streakFeedbackMessage()) {
            <p
              class="mb-5 rounded-lg bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800"
              role="status"
              aria-live="polite"
            >
              {{ streakFeedbackMessage() }}
            </p>
          }

          <div class="space-y-6">
            @for (mealType of mealTypes; track mealType) {
              <section>
                <div class="mb-3 flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <h3 class="text-base font-semibold text-stone-900">{{ mealTypeLabel(mealType) }}</h3>
                    <p class="text-sm text-stone-600">{{ mealTypeTimeRange(mealType) }}</p>
                  </div>
                  @if (itemsFor(selectedDate(), mealType).length > 0) {
                    <app-meal-slot-completion-button
                      [mealType]="mealType"
                      [completed]="isSlotCompletedFor(selectedDate(), mealType)"
                      [loading]="isSlotCompleting(selectedDate(), mealType)"
                      (toggled)="onToggleSlotCompletion(selectedDate(), mealType)"
                    />
                  }
                </div>

                @if (itemsFor(selectedDate(), mealType).length > 0) {
                  <app-meal-slot-items
                    [items]="itemsFor(selectedDate(), mealType)"
                    [removingId]="removingId()"
                    [canAdd]="canAddToSelectedDate()"
                    [completed]="isSlotCompletedFor(selectedDate(), mealType)"
                    (addItem)="openPicker(selectedDate(), mealType)"
                    (removeItem)="onRemoveItem($event)"
                  />
                } @else if (isPastDate(selectedDate())) {
                  <div
                    class="flex w-full items-center gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/40 p-4 text-left"
                  >
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-stone-200">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 text-stone-300">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-stone-500">No items planned</p>
                      <p class="text-sm text-stone-400">Past meals can't be changed</p>
                    </div>
                  </div>
                } @else {
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/30"
                    (click)="openPicker(selectedDate(), mealType)"
                  >
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-stone-200">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 text-stone-400">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-stone-600">No items planned</p>
                      <p class="text-sm font-semibold text-brand-700">Tap to add item</p>
                    </div>
                  </button>
                }
              </section>
            }
          </div>
        </div>

        <div class="flex justify-center pt-2">
          <button
            type="button"
            class="text-sm font-medium text-stone-500 transition-colors hover:text-brand-700 disabled:opacity-50"
            [disabled]="duplicating()"
            (click)="onDuplicatePreviousWeek()"
          >
            {{ duplicating() ? 'Copying last week...' : 'Duplicate previous week' }}
          </button>
        </div>
      }
    </div>
  `,
})
export class MealPlanComponent implements OnInit {
  readonly mealPlanService = inject(MealPlanService);
  private readonly recipeService = inject(RecipeService);
  private readonly inventoryService = inject(FoodInventoryService);
  private readonly progressService = inject(MealPlanProgressService);
  private readonly mealStreakService = inject(MealStreakService);

  readonly mealTypes = MEAL_TYPES;
  readonly selectedSlot = signal<SelectedSlot | null>(null);
  readonly selectedDate = signal(toISODate(new Date()));
  readonly removingId = signal<string | null>(null);
  readonly duplicating = signal(false);
  readonly completingSlotKey = signal<string | null>(null);
  readonly showConfetti = signal(false);
  private readonly celebrationArmed = signal(false);

  readonly weekRangeLabel = computed(() =>
    formatWeekRangeCompact(this.mealPlanService.weekDates())
  );

  readonly selectedDayHeading = computed(() => formatFullDayHeading(this.selectedDate()));

  readonly dayProgress = computed(() =>
    this.progressService.calculateDayProgress(
      this.selectedDate(),
      this.mealPlanService.entries()
    )
  );

  readonly dayProgressTitle = computed(() =>
    getDayProgressTitle(this.selectedDate(), this.isTodayDate(this.selectedDate()))
  );

  readonly streakFeedbackMessage = computed(() => {
    if (!this.isTodayDate(this.selectedDate())) {
      return null;
    }
    return this.mealStreakService.lastFeedbackMessage();
  });

  readonly weekStats = computed((): WeekStats => {
    const inventory = this.inventoryService.items();
    const recipes = this.recipeService.recipes();
    const plannedSlots = new Set<string>();
    let totalIngredients = 0;
    let availableIngredients = 0;
    const missingNames = new Set<string>();

    for (const item of this.mealPlanService.entries()) {
      if (item.item_type !== 'recipe' || !item.recipe_id) {
        continue;
      }

      plannedSlots.add(`${item.date}|${item.meal_type}`);
      const recipe = recipes.find((r) => r.id === item.recipe_id);
      const ingredients = recipe?.ingredients ?? [];
      const availability = getIngredientAvailability(ingredients, inventory);

      totalIngredients += availability.total;
      availableIngredients += availability.available;

      if (recipe?.ingredients) {
        const inventoryNames = inventory.map((entry) => entry.name.toLowerCase().trim());
        for (const ingredient of recipe.ingredients) {
          const name = ingredient.name.toLowerCase().trim();
          const hasMatch = inventoryNames.some(
            (inventoryName) => inventoryName.includes(name) || name.includes(inventoryName)
          );
          if (!hasMatch) {
            missingNames.add(name);
          }
        }
      }
    }

    return {
      mealsPlanned: plannedSlots.size,
      ingredientsReadyPercent:
        totalIngredients > 0
          ? Math.round((availableIngredients / totalIngredients) * 100)
          : null,
      itemsNeeded: missingNames.size,
    };
  });

  ngOnInit(): void {
    void Promise.all([
      this.mealPlanService.loadWeekAndToday(),
      this.recipeService.loadRecipes(),
      this.inventoryService.loadItems(),
    ]).then(() => {
      this.syncSelectedDateToWeek();
      this.armCelebrationTracking();
    });
  }

  isSlotCompletedFor(date: string, mealType: MealType): boolean {
    return isSlotCompleted(this.itemsFor(date, mealType));
  }

  isSlotCompleting(date: string, mealType: MealType): boolean {
    return this.completingSlotKey() === this.slotKey(date, mealType);
  }

  async onToggleSlotCompletion(date: string, mealType: MealType): Promise<void> {
    const previous = this.dayProgress();
    const key = this.slotKey(date, mealType);
    this.completingSlotKey.set(key);

    const { error } = await this.progressService.toggleMealSlotCompletion(date, mealType);
    this.completingSlotKey.set(null);

    if (error) {
      return;
    }

    await this.mealPlanService.getTodayMeals();

    const current = this.dayProgress();
    if (
      this.celebrationArmed() &&
      this.progressService.shouldTriggerDayCompletedCelebration(previous, current)
    ) {
      this.triggerConfetti();
    }
  }

  itemsFor(date: string, mealType: MealType): MealSlotItem[] {
    return this.mealPlanService.getItemsForSlot(date, mealType);
  }

  mealsForDate(date: string): number {
    return this.mealTypes.filter((mealType) => this.itemsFor(date, mealType).length > 0).length;
  }

  formatDayShort = formatDayShort;

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  mealTypeTimeRange(mealType: MealType): string {
    return MEAL_TYPE_TIME_RANGES[mealType];
  }

  isTodayDate(date: string): boolean {
    return isToday(date);
  }

  isPastDate = isPastDate;

  canAddToSelectedDate(): boolean {
    return !isPastDate(this.selectedDate());
  }

  isCurrentWeek(): boolean {
    const today = toISODate(new Date());
    return this.mealPlanService.weekDates().includes(today);
  }

  mealCountDots(count: number): number[] {
    return Array.from({ length: Math.min(count, 3) }, (_, index) => index);
  }

  openPicker(date: string, mealType: MealType): void {
    if (isPastDate(date)) {
      return;
    }
    this.selectedSlot.set({ date, mealType });
  }

  async onItemAdded(): Promise<void> {
    this.selectedSlot.set(null);
    await this.mealPlanService.getTodayMeals();
  }

  async onRemoveItem(item: MealSlotItem): Promise<void> {
    const title = getMealSlotItemDisplayName(item);
    if (!window.confirm(`Remove "${title}" from this meal slot?`)) {
      return;
    }

    this.removingId.set(item.id);
    await this.mealPlanService.removeSlotItem(item.id);
    this.removingId.set(null);
    await this.mealPlanService.getTodayMeals();
  }

  selectDate(date: string): void {
    this.selectedDate.set(date);
    this.selectedSlot.set(null);
  }

  async onPreviousWeek(): Promise<void> {
    this.mealPlanService.goToPreviousWeek();
    this.selectedSlot.set(null);
    await this.mealPlanService.getMealPlanForWeek(this.mealPlanService.weekStart());
    this.syncSelectedDateToWeek();
  }

  async onNextWeek(): Promise<void> {
    this.mealPlanService.goToNextWeek();
    this.selectedSlot.set(null);
    await this.mealPlanService.getMealPlanForWeek(this.mealPlanService.weekStart());
    this.syncSelectedDateToWeek();
  }

  async onTodayWeek(): Promise<void> {
    this.mealPlanService.goToTodayWeek();
    this.selectedSlot.set(null);
    await this.mealPlanService.loadWeekAndToday();
    this.selectedDate.set(toISODate(new Date()));
  }

  async onDuplicatePreviousWeek(): Promise<void> {
    if (
      !window.confirm(
        "Copy last week's meals into empty slots for this week? Existing meals will not be overwritten."
      )
    ) {
      return;
    }

    this.duplicating.set(true);
    const { copiedCount, error } = await this.mealPlanService.duplicatePreviousWeek(
      this.mealPlanService.weekStart()
    );
    this.duplicating.set(false);

    if (!error && copiedCount === 0) {
      window.alert('No empty slots were available to copy into.');
    }
  }

  private syncSelectedDateToWeek(): void {
    const weekDates = this.mealPlanService.weekDates();
    const current = this.selectedDate();

    if (weekDates.includes(current)) {
      return;
    }

    const today = toISODate(new Date());
    if (weekDates.includes(today)) {
      this.selectedDate.set(today);
      return;
    }

    const firstUpcoming = weekDates.find((date) => !isPastDate(date));
    this.selectedDate.set(firstUpcoming ?? weekDates[0]);
  }

  private slotKey(date: string, mealType: MealType): string {
    return `${date}|${mealType}`;
  }

  private armCelebrationTracking(): void {
    this.celebrationArmed.set(true);
  }

  private triggerConfetti(): void {
    this.showConfetti.set(false);
    requestAnimationFrame(() => this.showConfetti.set(true));
    window.setTimeout(() => this.showConfetti.set(false), 1100);
  }
}
