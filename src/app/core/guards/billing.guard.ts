import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { EntitlementService } from '../services/entitlement.service';
import { BillingService } from '../services/billing.service';

export const billingAvailableGuard: CanActivateFn = () => {
  const billingService = inject(BillingService);
  const router = inject(Router);

  if (!billingService.isAvailable()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};

export const premiumFeatureGuard: CanActivateFn = async () => {
  if (environment.useLocalApi) {
    return true;
  }

  const entitlementService = inject(EntitlementService);
  const router = inject(Router);

  if (entitlementService.status() !== 'loaded') {
    await entitlementService.load();
  }

  if (entitlementService.isPremium()) {
    return true;
  }

  return router.createUrlTree(['/pricing']);
};
