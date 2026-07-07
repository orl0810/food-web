import { TestBed } from '@angular/core/testing';
import { MealSlotItem } from '../models/meal-slot-item.model';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { MealPlanService } from './meal-plan.service';
import { PreparedPortionService } from './prepared-portion.service';
import { SupabaseService } from './supabase.service';

type MealPlanServiceInternals = {
  normalizeItem: (row: unknown) => MealSlotItem;
};

describe('MealPlanService', () => {
  let service: MealPlanService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MealPlanService,
        { provide: SupabaseService, useValue: { getClient: () => null } },
        { provide: LocalApiService, useValue: { isEnabled: () => false } },
        { provide: AuthService, useValue: { user: () => null } },
        { provide: PreparedPortionService, useValue: {} },
      ],
    });

    service = TestBed.inject(MealPlanService);
  });

  describe('normalizeItem', () => {
    it('preserves recipe image fields when normalizing meal plan items', () => {
      const normalizeItem = (service as unknown as MealPlanServiceInternals).normalizeItem;

      const normalized = normalizeItem({
        id: 'item-1',
        user_id: 'user-1',
        date: '2026-06-25',
        meal_type: 'lunch',
        item_type: 'recipe',
        recipe_id: 'recipe-1',
        prepared_portion_id: null,
        inventory_item_id: null,
        custom_name: null,
        quantity: null,
        unit: null,
        portions_used: 1,
        notes: null,
        sort_order: 0,
        status: 'planned',
        completed_at: null,
        created_at: '2026-06-25T12:00:00Z',
        recipe: {
          id: 'recipe-1',
          title: 'Pasta Carbonara',
          description: 'Classic pasta',
          tags: ['quick'],
          prep_time_minutes: 20,
          image_url: 'https://cdn.example.com/pasta.jpg',
          image_status: 'completed',
          image_storage_key: 'recipes/pasta.jpg',
          meal_type: 'lunch',
          category: 'Pasta',
        },
      });

      expect(normalized.recipe).toEqual({
        id: 'recipe-1',
        title: 'Pasta Carbonara',
        description: 'Classic pasta',
        tags: ['quick'],
        prep_time_minutes: 20,
        image_url: 'https://cdn.example.com/pasta.jpg',
        image_status: 'completed',
        image_storage_key: 'recipes/pasta.jpg',
        meal_type: 'lunch',
        category: 'Pasta',
      });
    });
  });
});
