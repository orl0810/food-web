import { environment } from '../../../environments/environment';

/** Resolves the app base URL used for Supabase auth redirects. */
export function getAuthSiteUrl(): string {
  const configured = environment.authSiteUrl?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export function getAuthCallbackUrl(): string {
  return `${getAuthSiteUrl()}/auth/callback`;
}

export function getAuthResetPasswordUrl(): string {
  return `${getAuthSiteUrl()}/auth/reset-password`;
}
