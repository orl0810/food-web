export type CheckoutPlanCode = 'early_access_monthly' | 'early_access_annual';

export type BillingErrorCode =
  | 'TRIAL_EXPIRED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'ACTIVE_SUBSCRIPTION_EXISTS'
  | 'PAYMENT_RECOVERY_REQUIRED'
  | 'INVALID_PLAN_CODE'
  | 'PRICING_PHASE_NOT_AVAILABLE'
  | 'PERSONAL_RECIPE_LIMIT_REACHED'
  | 'ACTIVE_MEAL_PLAN_LIMIT_REACHED'
  | 'SMART_SUGGESTION_LIMIT_REACHED'
  | 'BILLING_CONFIGURATION_ERROR';

export interface BillingPlanDisplay {
  code: CheckoutPlanCode;
  name: string;
  priceLabel: string;
  intervalLabel: string;
  monthlyEquivalent?: string;
  savingsLabel?: string;
  recommended?: boolean;
  features: string[];
}

export const EARLY_ACCESS_PLANS: BillingPlanDisplay[] = [
  {
    code: 'early_access_monthly',
    name: 'Early Access Monthly',
    priceLabel: '€3',
    intervalLabel: 'every month',
    features: [
      'Full access to all features',
      'Cancel anytime',
      'Early Access price retained while continuously subscribed',
    ],
  },
  {
    code: 'early_access_annual',
    name: 'Early Access Annual',
    priceLabel: '€20',
    intervalLabel: 'every year',
    monthlyEquivalent: '€1.67/month, billed annually',
    savingsLabel: 'Save €16 per year',
    recommended: true,
    features: [
      'Full access to all features',
      'Cancel anytime',
      'Early Access price retained while continuously subscribed',
    ],
  },
];

export const BILLING_ERROR_MESSAGES: Record<BillingErrorCode, string> = {
  TRIAL_EXPIRED: 'Your free trial has ended. Choose a plan to continue with premium features.',
  SUBSCRIPTION_REQUIRED: 'A subscription is required for this feature.',
  ACTIVE_SUBSCRIPTION_EXISTS:
    'You already have an active subscription. Manage billing from your account.',
  PAYMENT_RECOVERY_REQUIRED:
    'Your last payment failed. Update your payment method to keep premium access.',
  INVALID_PLAN_CODE: 'The selected plan is not available.',
  PRICING_PHASE_NOT_AVAILABLE: 'Pricing is not available right now.',
  PERSONAL_RECIPE_LIMIT_REACHED:
    'Free accounts can save up to 10 personal recipes. Upgrade to add more.',
  ACTIVE_MEAL_PLAN_LIMIT_REACHED:
    'Free accounts can plan meals for the current week only. Upgrade to plan additional weeks.',
  SMART_SUGGESTION_LIMIT_REACHED:
    'You have used all 3 AI recipe generations this month. Upgrade for unlimited access.',
  BILLING_CONFIGURATION_ERROR: 'Billing is temporarily unavailable. Please try again later.',
};

export function billingErrorMessage(code: string | null | undefined, fallback?: string): string {
  if (code && code in BILLING_ERROR_MESSAGES) {
    return BILLING_ERROR_MESSAGES[code as BillingErrorCode];
  }
  return fallback ?? 'Something went wrong. Please try again.';
}

export interface AdminBillingRow {
  user_id: string;
  email: string;
  display_name: string | null;
  plan_code: string | null;
  subscription_status: string | null;
  billing_interval: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  cancel_at_period_end: boolean | null;
  grace_period_ends_at: string | null;
  last_payment_at: string | null;
  last_payment_failed_at: string | null;
  is_premium: boolean;
}
