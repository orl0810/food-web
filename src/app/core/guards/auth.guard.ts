import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthFacadeService } from '../../features/auth/services/auth-facade.service';
import { sanitizeReturnUrl } from '../utils/return-url.utils';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  if (authService.isAuthenticated()) {
    return true;
  }

  const returnUrl = sanitizeReturnUrl(state.url);
  return router.createUrlTree(
    ['/auth/login'],
    returnUrl ? { queryParams: { returnUrl } } : undefined
  );
};

export const guestGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const authFacade = inject(AuthFacadeService);

  await authService.whenReady();

  if (!authService.isAuthenticated()) {
    return true;
  }

  const user = authService.getCurrentUser();
  if (!user) {
    return true;
  }

  const returnUrl = sanitizeReturnUrl(route.queryParamMap.get('returnUrl'));
  return authFacade.handlePostLoginRedirect(user.id, returnUrl);
};
