import { Cookie } from '../../icons';
import { buttonClasses } from '../common/Button';
import { setCookieConsent, type CookieConsent } from '../../lib/cookies';

interface CookieBannerProps {
  open: boolean;
  onClose: () => void;
}

export function CookieBanner({ open, onClose }: CookieBannerProps) {
  if (!open) return null;

  function choose(value: CookieConsent) {
    setCookieConsent(value);
    onClose();
  }

  return (
    <section
      role="region"
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-3 z-50 rounded-card border border-border bg-surface-raised p-4 shadow-xl sm:p-5 sm:left-6 sm:right-auto sm:max-w-md"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-lavender-surface sm:h-10 sm:w-10">
          <Cookie className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">We use cookies</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
            REVI uses essential cookies and browser storage to keep you signed in and remember your settings.
            Optional cookies help us improve the site. You can change your choice any time from Cookie settings in the footer.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
        <button type="button" onClick={() => choose('essential')} className={buttonClasses('secondary', 'py-2.5')}>Essential only</button>
        <button type="button" onClick={() => choose('all')} className={buttonClasses('primary', 'py-2.5')}>Accept all</button>
      </div>
    </section>
  );
}