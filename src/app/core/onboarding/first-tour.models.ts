export const FIRST_TOUR_ID = 'first-user-tour' as const;
export const FIRST_TOUR_VERSION = 2 as const;

export type FirstTourStep = 1 | 2 | 3 | 4 | 5 | 6;
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface OnboardingProgress {
  tourId: typeof FIRST_TOUR_ID;
  version: typeof FIRST_TOUR_VERSION;
  userId: string;
  status: OnboardingStatus;
  currentStep: FirstTourStep;
  updatedAt: string;
}
