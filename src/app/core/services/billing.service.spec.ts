import { TestBed } from '@angular/core/testing';
import { BillingService } from './billing.service';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';

describe('BillingService', () => {
  let service: BillingService;
  const invokeSpy = jasmine.createSpy('invoke');

  beforeEach(() => {
    invokeSpy.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        BillingService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              auth: {
                getSession: () =>
                  Promise.resolve({ data: { session: { access_token: 'token' } } }),
              },
              functions: { invoke: invokeSpy },
            }),
          },
        },
      ],
    });
    service = TestBed.inject(BillingService);
  });

  it('is unavailable in local mode', () => {
    expect(service.isAvailable()).toBeFalse();
  });

  it('sends only planCode to checkout function', async () => {
    const previous = environment.useLocalApi;
    environment.useLocalApi = false;
    invokeSpy.and.returnValue(
      Promise.resolve({ data: { url: 'https://checkout.test' }, error: null })
    );

    const url = await service.createCheckoutSession('early_access_annual');

    expect(url).toBe('https://checkout.test');
    expect(invokeSpy).toHaveBeenCalledWith(
      'create-checkout-session',
      jasmine.objectContaining({
        body: { planCode: 'early_access_annual' },
      })
    );
    environment.useLocalApi = previous;
  });
});
