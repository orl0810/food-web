import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AnalyticsService } from './analytics.service';
import { ProductEvent } from './analytics-events';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let insertSpy: jasmine.Spy;
  let originalUseLocalApi: boolean;

  beforeEach(() => {
    originalUseLocalApi = environment.useLocalApi;
    environment.useLocalApi = false;
    insertSpy = jasmine.createSpy('insert').and.resolveTo({ error: null });

    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 'user-123' }),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              from: () => ({
                insert: insertSpy,
              }),
            }),
          },
        },
      ],
    });

    service = TestBed.inject(AnalyticsService);
  });

  afterEach(() => {
    environment.useLocalApi = originalUseLocalApi;
  });

  it('no-ops in local API mode', async () => {
    environment.useLocalApi = true;
    await service.track(ProductEvent.CriticalWorkflowFailed, { source: 'test' });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('inserts events for the authenticated user only', async () => {
    await service.track(ProductEvent.BarcodeLookupFailed, {
      source: 'test',
      error_code: 'LOOKUP_UNAVAILABLE',
    });

    expect(insertSpy).toHaveBeenCalledWith({
      user_id: 'user-123',
      event_name: ProductEvent.BarcodeLookupFailed,
      properties: {
        source: 'test',
        error_code: 'LOOKUP_UNAVAILABLE',
      },
    });
  });

  it('swallows insert failures without throwing', async () => {
    insertSpy.and.resolveTo({ error: { message: 'insert failed' } });

    await expectAsync(
      service.track(ProductEvent.ShoppingListGenerationFailed, { source: 'test' })
    ).toBeResolved();
  });
});
