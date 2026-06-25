import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  DEFAULT_MEAL_STREAK_RULE,
  MEAL_STREAK_LOOKBACK_DAYS,
  MealStreakRule,
  UserMealStreak,
} from '../models/meal-streak.model';
import { MealSlotItem } from '../models/meal-slot-item.model';
import { addDays } from '../../shared/utils/meal-plan.utils';
import {
  computeStreakFromItems,
  getLocalDateKey,
  getStreakFeedback,
} from '../../shared/utils/meal-streak.utils';
import { AuthService } from './auth.service';
import { MealPlanService } from './meal-plan.service';
import { SupabaseService } from './supabase.service';

const FEEDBACK_MESSAGE_MS = 4000;
const STREAK_PULSE_MS = 700;

interface StreakRow {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  streak_rule: MealStreakRule;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class MealStreakService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly mealPlanService = inject(MealPlanService);

  private readonly currentStreakSignal = signal(0);
  private readonly longestStreakSignal = signal(0);
  private readonly isLoadingStreakSignal = signal(false);
  private readonly streakJustIncreasedSignal = signal(false);
  private readonly lastFeedbackMessageSignal = signal<string | null>(null);
  private readonly streakRuleSignal = signal<MealStreakRule>(DEFAULT_MEAL_STREAK_RULE);

  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private pulseTimeout: ReturnType<typeof setTimeout> | null = null;
  private recalcInFlight: Promise<UserMealStreak | null> | null = null;

  readonly currentStreak = this.currentStreakSignal.asReadonly();
  readonly longestStreak = this.longestStreakSignal.asReadonly();
  readonly isLoadingStreak = this.isLoadingStreakSignal.asReadonly();
  readonly streakJustIncreased = this.streakJustIncreasedSignal.asReadonly();
  readonly lastFeedbackMessage = this.lastFeedbackMessageSignal.asReadonly();

  async loadStreak(): Promise<UserMealStreak | null> {
    const userId = this.authService.user()?.id;
    if (!userId) {
      return null;
    }

    this.isLoadingStreakSignal.set(true);

    try {
      if (environment.useLocalApi) {
        return await this.recalculateStreak();
      }

      const row = await this.fetchStreakRow(userId);
      if (!row) {
        return await this.recalculateStreak();
      }

      this.applyStreakRow(row);
      return this.mapRow(row);
    } finally {
      this.isLoadingStreakSignal.set(false);
    }
  }

  async recalculateStreak(): Promise<UserMealStreak | null> {
    if (this.recalcInFlight) {
      return this.recalcInFlight;
    }

    this.recalcInFlight = this.recalculateStreakInternal();
    try {
      return await this.recalcInFlight;
    } finally {
      this.recalcInFlight = null;
    }
  }

  async handleCompletionChanged(date: string): Promise<void> {
    const userId = this.authService.user()?.id;
    if (!userId) {
      return;
    }

    const previousStreak = this.currentStreakSignal();
    const streak = await this.recalculateStreak();
    if (!streak) {
      return;
    }

    if (streak.currentStreak > previousStreak) {
      this.triggerStreakPulse();
      const feedback = getStreakFeedback(previousStreak, streak.currentStreak, date);
      if (feedback) {
        this.showFeedback(feedback);
      }
    }
  }

  clearFeedback(): void {
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
      this.feedbackTimeout = null;
    }
    this.lastFeedbackMessageSignal.set(null);
  }

  private async recalculateStreakInternal(): Promise<UserMealStreak | null> {
    const userId = this.authService.user()?.id;
    if (!userId) {
      return null;
    }

    const items = await this.fetchItemsForStreak();
    const rule = this.streakRuleSignal();
    const computed = computeStreakFromItems(items, rule);
    const streak: UserMealStreak = {
      id: '',
      userId,
      currentStreak: computed.currentStreak,
      longestStreak: computed.longestStreak,
      lastCompletedDate: computed.lastCompletedDate,
      streakRule: rule,
      updatedAt: new Date().toISOString(),
    };

    if (environment.useLocalApi) {
      this.applyStreakValues(streak);
      return streak;
    }

    const saved = await this.upsertStreakRow(userId, streak);
    if (saved) {
      this.applyStreakRow(saved);
      return this.mapRow(saved);
    }

    this.applyStreakValues(streak);
    return streak;
  }

  private async fetchItemsForStreak(): Promise<MealSlotItem[]> {
    const today = getLocalDateKey();
    const start = addDays(today, -MEAL_STREAK_LOOKBACK_DAYS);

    if (environment.useLocalApi) {
      return this.mealPlanService.fetchMealPlanForDateRange(start, today);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;
    if (!client || !userId) {
      return [];
    }

    const { data, error } = await client
      .from('meal_plan_items')
      .select('id, user_id, date, meal_type, status, item_type, sort_order, created_at, completed_at')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', today);

    if (error || !data) {
      return [];
    }

    return data as MealSlotItem[];
  }

  private async fetchStreakRow(userId: string): Promise<StreakRow | null> {
    const client = this.supabaseService.getClient();
    if (!client) {
      return null;
    }

    const { data, error } = await client
      .from('user_meal_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as StreakRow;
  }

  private async upsertStreakRow(userId: string, streak: UserMealStreak): Promise<StreakRow | null> {
    const client = this.supabaseService.getClient();
    if (!client) {
      return null;
    }

    const existing = await this.fetchStreakRow(userId);
    const longestStreak = Math.max(
      streak.longestStreak,
      existing?.longest_streak ?? 0
    );
    const payload = {
      user_id: userId,
      current_streak: streak.currentStreak,
      longest_streak: longestStreak,
      last_completed_date: streak.lastCompletedDate,
      streak_rule: streak.streakRule,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data, error } = await client
        .from('user_meal_streaks')
        .update(payload)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) {
        return null;
      }

      return data as StreakRow;
    }

    const { data, error } = await client
      .from('user_meal_streaks')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return null;
    }

    return data as StreakRow;
  }

  private applyStreakRow(row: StreakRow): void {
    this.streakRuleSignal.set(row.streak_rule);
    this.applyStreakValues({
      id: row.id,
      userId: row.user_id,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      lastCompletedDate: row.last_completed_date,
      streakRule: row.streak_rule,
      updatedAt: row.updated_at,
    });
  }

  private applyStreakValues(streak: UserMealStreak): void {
    this.currentStreakSignal.set(streak.currentStreak);
    this.longestStreakSignal.set(streak.longestStreak);
  }

  private mapRow(row: StreakRow): UserMealStreak {
    return {
      id: row.id,
      userId: row.user_id,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      lastCompletedDate: row.last_completed_date,
      streakRule: row.streak_rule,
      updatedAt: row.updated_at,
    };
  }

  private triggerStreakPulse(): void {
    if (this.pulseTimeout) {
      clearTimeout(this.pulseTimeout);
    }

    this.streakJustIncreasedSignal.set(true);
    this.pulseTimeout = setTimeout(() => {
      this.streakJustIncreasedSignal.set(false);
      this.pulseTimeout = null;
    }, STREAK_PULSE_MS);
  }

  private showFeedback(message: string): void {
    this.clearFeedback();
    this.lastFeedbackMessageSignal.set(message);
    this.feedbackTimeout = setTimeout(() => {
      this.lastFeedbackMessageSignal.set(null);
      this.feedbackTimeout = null;
    }, FEEDBACK_MESSAGE_MS);
  }
}
