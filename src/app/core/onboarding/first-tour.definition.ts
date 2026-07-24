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
    title: 'You already have planned recipes',
    description:
      'You can change it if you don’t like it, view it, or create your own from the Recipes menu.',
    action: 'Continue',
  },
  4: {
    title: 'Everything you need is here',
    description: 'Everything you need to complete your meal plan is here.',
    action: 'Continue',
  },
  5: {
    title: 'See what you have',
    description: 'Inventory keeps your food, locations, and expiration dates in one place.',
    action: 'Continue',
  },
  6: {
    title: 'Cook your plan',
    description: 'Mark this planned meal as cooked. The tour finishes after Soozi saves the change.',
    action: 'Finish',
  },
};

export const SHOPPING_NAV_BRIDGE_COPY: FirstTourCopy = {
  title: 'Next: Shopping',
  description: 'Open Shopping to see ingredients for your plan.',
  action: 'Continue',
};
