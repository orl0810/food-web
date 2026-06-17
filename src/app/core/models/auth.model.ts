import { Session } from '@supabase/supabase-js';

export interface AuthResult {
  error: string | null;
  needsConfirmation?: boolean;
}

export interface MagicLinkResult {
  error: string | null;
}

export interface AuthCallbackResult {
  error: string | null;
  session: Session | null;
}

export type AuthFlowMode = 'magic_link' | 'password_sign_in' | 'password_sign_up';

export type LoginUiState = 'idle' | 'sending' | 'linkSent' | 'redirecting' | 'error';

export type ResetPasswordMode = 'request' | 'update';
