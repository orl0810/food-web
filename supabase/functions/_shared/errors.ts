import { corsHeaders } from './cors.ts';

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
  | 'BILLING_CONFIGURATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'ACCESS_DENIED'
  | 'NO_STRIPE_CUSTOMER'
  | 'METHOD_NOT_ALLOWED';

export function billingErrorResponse(
  cors: Record<string, string>,
  code: BillingErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
): Response {
  return new Response(JSON.stringify({ error: message, code, ...details }), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
    },
  });
}

const ERROR_MESSAGES: Partial<Record<BillingErrorCode, { message: string; status: number }>> = {
  UNAUTHENTICATED: { message: 'You must be signed in.', status: 401 },
  ACCESS_DENIED: { message: 'Access denied.', status: 403 },
  INVALID_PLAN_CODE: { message: 'Invalid plan selected.', status: 400 },
  PRICING_PHASE_NOT_AVAILABLE: { message: 'Pricing is not available right now.', status: 400 },
  ACTIVE_SUBSCRIPTION_EXISTS: {
    message: 'You already have an active subscription. Manage billing instead.',
    status: 409,
  },
  PAYMENT_RECOVERY_REQUIRED: {
    message: 'Please update your payment method in the billing portal.',
    status: 409,
  },
  NO_STRIPE_CUSTOMER: { message: 'No billing account found yet.', status: 404 },
  BILLING_CONFIGURATION_ERROR: { message: 'Billing is not configured.', status: 500 },
  METHOD_NOT_ALLOWED: { message: 'Method not allowed.', status: 405 },
  SMART_SUGGESTION_LIMIT_REACHED: {
    message: 'You have used all smart suggestions for this month.',
    status: 429,
  },
};

export function mapErrorToResponse(req: Request, error: unknown): Response {
  const cors = corsHeaders(req.headers.get('Origin'));
  const code = (
    error instanceof Error && error.message in (ERROR_MESSAGES as Record<string, unknown>)
      ? error.message
      : 'BILLING_CONFIGURATION_ERROR'
  ) as BillingErrorCode;

  const mapped = ERROR_MESSAGES[code] ?? { message: 'Something went wrong.', status: 500 };
  return billingErrorResponse(cors, code, mapped.message, mapped.status);
}
