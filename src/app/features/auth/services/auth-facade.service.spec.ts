import { TestBed } from '@angular/core/testing';
import { AuthFacadeService } from './auth-facade.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { provideRouter } from '@angular/router';

describe('AuthFacadeService returnUrl', () => {
  let facade: AuthFacadeService;
  let onboarding: jasmine.SpyObj<OnboardingService>;
  let profiles: jasmine.SpyObj<UserProfileService>;

  beforeEach(() => {
    onboarding = jasmine.createSpyObj<OnboardingService>('OnboardingService', ['getStatus']);
    profiles = jasmine.createSpyObj<UserProfileService>('UserProfileService', [
      'ensureProfileForUser',
    ]);
    profiles.ensureProfileForUser.and.resolveTo();
    onboarding.getStatus.and.resolveTo({ status: 'completed' } as never);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        AuthFacadeService,
        { provide: OnboardingService, useValue: onboarding },
        { provide: UserProfileService, useValue: profiles },
      ],
    });

    facade = TestBed.inject(AuthFacadeService);
  });

  it('redirects to a safe returnUrl when onboarding is complete', async () => {
    const tree = await facade.handlePostLoginRedirect('user-1', '/meal-plan');
    expect(tree.toString()).toContain('/meal-plan');
  });

  it('ignores unsafe returnUrl and falls back to dashboard', async () => {
    const tree = await facade.handlePostLoginRedirect('user-1', 'https://evil.test');
    expect(tree.toString()).toContain('/dashboard');
  });

  it('prefers onboarding over returnUrl when pending', async () => {
    onboarding.getStatus.and.resolveTo({ status: 'pending' } as never);
    const tree = await facade.handlePostLoginRedirect('user-1', '/recipes');
    expect(tree.toString()).toContain('/onboarding');
  });
});
