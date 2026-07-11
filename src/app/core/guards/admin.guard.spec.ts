import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';
import { UserProfileService } from '../services/user-profile.service';

describe('adminGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let userProfileService: jasmine.SpyObj<UserProfileService>;
  let router: Router;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['whenReady', 'isAuthenticated']);
    userProfileService = jasmine.createSpyObj<UserProfileService>('UserProfileService', [
      'resolveRole',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: UserProfileService, useValue: userProfileService },
      ],
    });

    router = TestBed.inject(Router);
    authService.whenReady.and.resolveTo();
  });

  it('allows administrators after role resolution', async () => {
    authService.isAuthenticated.and.returnValue(true);
    userProfileService.resolveRole.and.resolveTo('admin');

    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(result).toBeTrue();
    expect(userProfileService.resolveRole).toHaveBeenCalled();
  });

  it('redirects regular users to dashboard', async () => {
    authService.isAuthenticated.and.returnValue(true);
    userProfileService.resolveRole.and.resolveTo('user');

    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toContain('/dashboard');
  });

  it('redirects unauthenticated users to login', async () => {
    authService.isAuthenticated.and.returnValue(false);

    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(userProfileService.resolveRole).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toContain('/auth/login');
  });

  it('waits for auth readiness before checking role', async () => {
    authService.isAuthenticated.and.returnValue(true);
    userProfileService.resolveRole.and.resolveTo('admin');

    await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(authService.whenReady).toHaveBeenCalled();
    expect(userProfileService.resolveRole).toHaveBeenCalled();
  });
});
