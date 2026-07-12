import { TestBed } from '@angular/core/testing';
import { EntitlementService } from './entitlement.service';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';

describe('EntitlementService', () => {
  let service: EntitlementService;
  const rpcSpy = jasmine.createSpy('rpc').and.returnValue(Promise.resolve({ data: null, error: null }));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EntitlementService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({ rpc: rpcSpy }),
          },
        },
      ],
    });
    service = TestBed.inject(EntitlementService);
  });

  it('returns premium stub in local API mode', async () => {
    environment.useLocalApi = true;
    const entitlements = await service.load();
    expect(entitlements?.isPremium).toBeTrue();
    expect(rpcSpy).not.toHaveBeenCalled();
    environment.useLocalApi = true;
  });

  it('canCreatePersonalRecipe respects free limits', async () => {
    environment.useLocalApi = true;
    await service.load();
    expect(service.canCreatePersonalRecipe()).toBeTrue();
  });
});
