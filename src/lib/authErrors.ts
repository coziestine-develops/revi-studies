import { errorMessage } from './format';

interface AuthLikeError {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

/** Turns Supabase Auth errors into messages a student can act on. */
export function friendlyAuthError(error: unknown): string {
  const details = (error ?? {}) as AuthLikeError;
  const code = typeof details.code === 'string' ? details.code : '';
  const status = typeof details.status === 'number' ? details.status : 0;
  const text = `${code} ${errorMessage(error)}`.toLowerCase();

  if (status === 429 || text.includes('rate limit') || text.includes('too many')) {
    return 'Too many emails were requested for this address. Wait about an hour before trying again, or sign in if you already have an account.';
  }
  if (text.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (text.includes('email not confirmed')) return 'Verify your email first. Check your inbox for the link.';
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (text.includes('provider is not enabled') || text.includes('unsupported provider')) {
    return "Google sign-in isn't set up for this project yet. Use email and password for now.";
  }
  if (text.includes('unacceptable audience') || text.includes('bad id token')) {
    return "Google sign-in couldn't be linked to REVI's account system. Check the Google client ID under Supabase > Authentication > Providers > Google.";
  }
  if (text.includes('weak password') || text.includes('should be at least')) {
    return 'That password is too weak. Use at least 6 characters.';
  }
  return errorMessage(error);
}

/**
 * Turns Firebase Auth errors from the Google popup into messages a student can act on.
 * Returns null when the student simply closed the popup, since that is not an error to show.
 */
export function friendlyGoogleError(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for REVI, then try again.';
    case 'auth/unauthorized-domain':
      return 'This site is not authorized for Google sign-in. Add it under Firebase > Authentication > Settings > Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is turned off in Firebase. Enable it under Firebase > Authentication > Sign-in method.';
    case 'auth/network-request-failed':
      return 'Google sign-in lost its connection. Check your internet and try again.';
    default:
      return friendlyAuthError(error);
  }
}
