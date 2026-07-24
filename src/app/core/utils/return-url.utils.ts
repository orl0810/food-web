/**
 * Allows only same-app relative paths for post-login redirects.
 * Rejects protocol-relative URLs, absolute URLs, and auth loops.
 */
export function sanitizeReturnUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }

  if (trimmed.includes('://')) {
    return null;
  }

  const pathOnly = trimmed.split('?')[0]?.split('#')[0] ?? trimmed;
  if (
    pathOnly === '/auth/login' ||
    pathOnly === '/login' ||
    pathOnly.startsWith('/auth/callback') ||
    pathOnly.startsWith('/auth/reset-password')
  ) {
    return null;
  }

  return trimmed;
}
