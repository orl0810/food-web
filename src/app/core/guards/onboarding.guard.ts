import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OnboardingService } from '../services/onboarding.service';

export const pendingOnboardingGuard: CanActivateFn = async () => {
  const onboardingService = inject(OnboardingService);
  const router = inject(Router);

  const status = await onboardingService.getStatus();
  if (status.status === 'pending' || status.status === 'in_progress') {
    return router.createUrlTree(['/onboarding']);
  }

  return true;
};

export const onboardingEntryGuard: CanActivateFn = (route) => {
  const onboardingService = inject(OnboardingService);
  const router = inject(Router);

  return onboardingService.getStatus().then((status) => {
    const restart = route.queryParamMap.get('restart') === 'true';
    if ((status.status === 'completed' || status.status === 'skipped') && !restart) {
      return router.createUrlTree(['/dashboard']);
    }
    return true;
  });
};
