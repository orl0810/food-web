import { Injectable, inject } from '@angular/core';
import { StorageService } from '../services/storage.service';
import {
  FIRST_TOUR_ID,
  FIRST_TOUR_VERSION,
  FirstTourStep,
  OnboardingProgress,
  OnboardingStatus,
} from './first-tour.models';

@Injectable({ providedIn: 'root' })
export class FirstTourStorageService {
  private readonly storage = inject(StorageService);

  get(userId: string): OnboardingProgress | null {
    const progress = this.storage.getJson<OnboardingProgress>(this.key(userId));
    if (
      !progress ||
      progress.tourId !== FIRST_TOUR_ID ||
      progress.version !== FIRST_TOUR_VERSION ||
      progress.userId !== userId
    ) {
      return null;
    }
    return progress;
  }

  save(userId: string, status: OnboardingStatus, currentStep: FirstTourStep): OnboardingProgress {
    const progress: OnboardingProgress = {
      tourId: FIRST_TOUR_ID,
      version: FIRST_TOUR_VERSION,
      userId,
      status,
      currentStep,
      updatedAt: new Date().toISOString(),
    };
    this.storage.setJson(this.key(userId), progress);
    return progress;
  }

  reset(userId: string): void {
    this.storage.removeItem(this.key(userId));
  }

  private key(userId: string): string {
    return `soozi:${FIRST_TOUR_ID}:v${FIRST_TOUR_VERSION}:${userId}`;
  }
}

