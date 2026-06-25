const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /\b429\b/,
  /only request this after/i,
  /over_email_send_rate_limit/i,
];

const EXPIRED_LINK_PATTERNS = [/invalid or has expired/i, /one-time token not found/i];

/** Cooldown between magic-link resend attempts (matches Supabase per-user throttle). */
export const MAGIC_LINK_RESEND_COOLDOWN_SECONDS = 60;

export function isAuthRateLimitError(message: string): boolean {
  return RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(message));
}

export function formatAuthError(message: string): string {
  if (isAuthRateLimitError(message)) {
    const waitMatch = message.match(/after (\d+) seconds/i);
    const waitHint = waitMatch ? ` Wait ${waitMatch[1]} seconds.` : ' Wait a few minutes.';
    return `Too many email attempts.${waitHint} Try signing in with your password instead, or request a new link later.`;
  }

  if (EXPIRED_LINK_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'This sign-in link is invalid or has expired. Request a new one — older links stop working when a new email is sent.';
  }

  return message;
}
