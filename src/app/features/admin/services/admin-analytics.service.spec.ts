import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { AdminAnalyticsService } from './admin-analytics.service';
import { mapAdminAnalyticsResponse } from '../models/admin-analytics.model';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let rpcSpy: jasmine.Spy;
  let originalUseLocalApi: boolean;
  let authUser: { id: string } | null;

  beforeEach(() => {
    originalUseLocalApi = environment.useLocalApi;
    environment.useLocalApi = false;
    authUser = { id: 'admin-1' };
    rpcSpy = jasmine.createSpy('rpc').and.resolveTo({
      data: {
        period: { start_date: '2026-01-01T00:00:00.000Z', end_date: '2026-02-01T00:00:00.000Z' },
        users: {
          total_users: 10,
          new_users: 4,
          onboarding_started: 3,
          onboarding_completed: 2,
          onboarding_completion_rate: 66.67,
          activated_users: 1,
          activation_rate: 25,
          users_with_no_meaningful_action: 2,
        },
        engagement: {
          daily_active_users: 1,
          weekly_active_users: 3,
          monthly_active_users: 5,
          returning_users: 2,
          consecutive_week_users: 1,
          day_seven_retention_rate: null,
          week_four_retention_rate: null,
        },
        meal_plans: {
          total_meal_plans: 8,
          unique_planning_users: 3,
          planned_meals: 12,
          cooked_meals: 6,
          completed_meals: 4,
          meal_completion_rate: 33.33,
          average_completed_meals_per_active_user: 1.3,
        },
        product_usage: {
          recipes_created: 5,
          recipe_creators: 2,
          inventory_items_added: 7,
          shopping_lists_generated: 2,
          prepared_portions_created: 1,
          prepared_portions_consumed: 3,
        },
        friction: {
          onboarding_abandoned: 1,
          users_without_meal_plan_after_onboarding: 1,
          meal_plan_generation_failures: 0,
          recipe_import_started: 2,
          recipe_import_completed: 1,
          recipe_import_failures: 1,
          recipe_import_completion_rate: 50,
          critical_workflow_failures: 0,
          meal_photo_analysis_failures: 0,
        },
        funnel: {
          registered: 4,
          onboarding_completed: 2,
          first_meal_plan: 2,
          first_meal_eaten: 1,
        },
      },
      error: null,
    });

    TestBed.configureTestingModule({
      providers: [
        AdminAnalyticsService,
        {
          provide: AuthService,
          useValue: {
            user: () => authUser,
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              rpc: rpcSpy,
            }),
          },
        },
      ],
    });

    service = TestBed.inject(AdminAnalyticsService);
  });

  afterEach(() => {
    environment.useLocalApi = originalUseLocalApi;
  });

  it('maps RPC responses into typed analytics', async () => {
    await service.load();

    expect(service.data()?.users.totalUsers).toBe(10);
    expect(service.data()?.engagement.daySevenRetentionRate).toBeNull();
    expect(service.data()?.funnel.firstMealEaten).toBe(1);
    expect(service.lastUpdated()).toBeTruthy();
  });

  it('marks analytics unavailable in local API mode', async () => {
    environment.useLocalApi = true;
    await service.load();

    expect(service.unavailable()).toBeTrue();
    expect(service.data()).toBeNull();
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('stores RPC errors for retry UI', async () => {
    rpcSpy.and.resolveTo({ data: null, error: { message: 'Access denied' } });

    await service.load();

    expect(service.error()).toBe('Access denied');
    expect(service.data()).toBeNull();
  });

  it('clears cached analytics when auth user is removed', () => {
    service.clear();
    expect(service.data()).toBeNull();
    expect(service.error()).toBeNull();
    expect(service.lastUpdated()).toBeNull();
  });
});

describe('mapAdminAnalyticsResponse', () => {
  it('returns zero defaults for empty payloads', () => {
    const mapped = mapAdminAnalyticsResponse({});

    expect(mapped.users.totalUsers).toBe(0);
    expect(mapped.engagement.daySevenRetentionRate).toBeNull();
    expect(mapped.friction.recipeImportCompletionRate).toBeNull();
  });
});
