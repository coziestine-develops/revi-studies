export type CookieConsent = 'all' | 'essential';

const NAME = 'revi_cookie_consent';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Returns the saved choice, or null when the visitor hasn't chosen yet. */
export function getCookieConsent(): CookieConsent | null {
  try {
    const match = document.cookie.split('; ').find((row) => row.startsWith(`${NAME}=`));
    const value = match?.split('=')[1];
    return value === 'all' || value === 'essential' ? value : null;
  } catch {
    return null;
  }
}

/** Saves the choice in a first-party cookie for one year. */
export function setCookieConsent(value: CookieConsent): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${NAME}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookies may be blocked; the banner simply shows again next visit.
  }
}
