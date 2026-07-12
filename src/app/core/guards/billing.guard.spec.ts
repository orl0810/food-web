import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { billingAvailableGuard } from './billing.guard';
import { BillingService } from '../services/billing.service';
import { environment } from '../../../environments/environment';

describe('billingAvailableGuard', () => {
  it('redirects when billing unavailable in local mode', async () => {
    environment.useLocalApi = true;
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BillingService, useValue: { isAvailable: () => false } },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      billingAvailableGuard({} as never, {} as never)
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toContain('/dashboard');
  });
});
