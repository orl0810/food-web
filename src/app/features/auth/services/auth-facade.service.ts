import { Injectable, inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { UserProfileService } from '../../../core/services/user-profile.service';

@Injectable({ providedIn: 'root' })
export class AuthFacadeService {
  private readonly router = inject(Router);
  private readonly userProfileService = inject(UserProfileService);
  private readonly onboardingService = inject(OnboardingService);

  async handlePostLoginRedirect(userId: string): Promise<UrlTree> {
    await this.userProfileService.ensureProfileForUser(userId);

    const status = await this.onboardingService.getStatus();
    if (status.status === 'pending' || status.status === 'in_progress') {
      return this.router.createUrlTree(['/onboarding']);
    }

    return this.router.createUrlTree(['/dashboard']);
  }
}
