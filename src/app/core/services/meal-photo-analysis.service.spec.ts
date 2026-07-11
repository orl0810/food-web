import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { MealPhotoAnalysisService } from './meal-photo-analysis.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { FoodLogPhotoService } from './food-log-photo.service';

describe('MealPhotoAnalysisService', () => {
  let service: MealPhotoAnalysisService;
  let originalUseLocalApi: boolean;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    originalUseLocalApi = environment.useLocalApi;
    environment.useLocalApi = false;
    fetchSpy = spyOn(window, 'fetch');

    TestBed.configureTestingModule({
      providers: [
        MealPhotoAnalysisService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              auth: {
                getSession: async () => ({
                  data: { session: { access_token: 'token-123' } },
                  error: null,
                }),
              },
              storage: {
                from: () => ({
                  upload: async () => ({ error: null }),
                }),
              },
              from: () => ({
                insert: async () => ({ error: null }),
                update: () => ({ eq: async () => ({ error: null }) }),
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          },
        },
        {
          provide: AuthService,
          useValue: { user: () => ({ id: 'user-1' }) },
        },
        {
          provide: FoodLogPhotoService,
          useValue: {
            optimizeImage: async (file: File) => file,
          },
        },
      ],
    });

    service = TestBed.inject(MealPhotoAnalysisService);
  });

  afterEach(() => {
    environment.useLocalApi = originalUseLocalApi;
  });

  it('reports unavailable in local API mode', () => {
    environment.useLocalApi = true;
    expect(service.isAvailable()).toBeFalse();
  });

  it('creates analysis with user-scoped storage path', async () => {
    const file = new File(['abc'], 'meal.jpg', { type: 'image/jpeg' });
    const result = await service.createAnalysis(file);
    expect(result.analysisId).toBeTruthy();
    expect(result.storagePath.startsWith('user-1/')).toBeTrue();
  });

  it('maps analyze errors from edge function response', async () => {
    fetchSpy.and.resolveTo(
      new Response(JSON.stringify({ error: 'No food detected', error_code: 'no_food_detected' }), {
        status: 422,
      })
    );

    const result = await service.analyze('analysis-1', { mealType: 'lunch' });
    expect(result.draft).toBeNull();
    expect(result.errorCode).toBe('no_food_detected');
    expect(result.error).toContain('No food');
  });

  it('returns draft on successful analyze response', async () => {
    fetchSpy.and.resolveTo(
      new Response(
        JSON.stringify({
          draft: {
            analysisId: 'analysis-1',
            title: 'Salad',
            description: null,
            detectedItems: [
              {
                id: 'item-1',
                name: 'Lettuce',
                estimatedQuantity: 1,
                unit: 'cup',
                preparation: null,
                confidence: 0.8,
                alternatives: [],
                userModified: false,
              },
            ],
            estimatedServing: { amount: 1, unit: 'bowl' },
            nutritionEstimate: {
              calories: 120,
              protein_g: 3,
              carbohydrates_g: 10,
              fat_g: 4,
              fiber_g: 2,
              sugar_g: null,
            },
            confidence: {
              overall: 0.8,
              foodIdentification: 0.85,
              portionEstimation: 0.6,
              nutritionEstimation: 0.55,
            },
            assumptions: [],
            clarificationQuestions: [],
            warnings: [],
          },
        }),
        { status: 200 }
      )
    );

    const result = await service.analyze('analysis-1');
    expect(result.error).toBeNull();
    expect(result.draft?.title).toBe('Salad');
  });
});
