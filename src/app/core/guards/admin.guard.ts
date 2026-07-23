import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserProfileService } from '../services/user-profile.service';
import { sanitizeReturnUrl } from '../utils/return-url.utils';

export const adminGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const userProfileService = inject(UserProfileService);
  const router = inject(Router);

  await authService.whenReady();

  if (!authService.isAuthenticated()) {
    const returnUrl = sanitizeReturnUrl(state.url);
    return router.createUrlTree(
      ['/auth/login'],
      returnUrl ? { queryParams: { returnUrl } } : undefined
    );
  }

  const role = await userProfileService.resolveRole();
  if (role === 'admin') {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
