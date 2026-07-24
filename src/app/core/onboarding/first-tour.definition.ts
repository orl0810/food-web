import { FirstTourStep } from './first-tour.models';

export interface FirstTourCopy {
  title: string;
  description: string;
  action: string;
}

export const FIRST_TOUR_COPY: Record<FirstTourStep, FirstTourCopy> = {
  1: {
    title: 'Welcome to Soozi',
    description: 'Let’s take a quick tour from planning a meal to cooking it.',
    action: 'Start',
  },
  2: {
    title: 'Plan your meals',
    description: 'Generate a meal plan, then choose your dates and meals in the dialog.',
    action: 'Continue',
  },
  3: {
    title: 'Shop what you need',
    description: 'Check an item to add it to Inventory. Soozi removes it from this list after it is saved.',
    action: 'Continue',
  },
  4: {
    title: 'See what you have',
    description: 'Inventory keeps your food, locations, and expiration dates in one place.',
    action: 'Continue',
  },
  5: {
    title: 'Cook your plan',
    description: 'Mark this planned meal as cooked. The tour finishes after Soozi saves the change.',
    action: 'Finish',
  },
};

