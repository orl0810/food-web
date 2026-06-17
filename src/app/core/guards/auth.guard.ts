import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthFacadeService } from '../../features/auth/services/auth-facade.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = async () => {
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

  return authFacade.handlePostLoginRedirect(user.id);
};
