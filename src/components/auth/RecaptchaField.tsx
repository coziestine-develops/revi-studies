import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

interface GoogleRecaptcha {
  ready: (callback: () => void) => void;
  render: (container: HTMLElement, options: Record<string, unknown>) => number;
  reset: (widgetId?: number) => void;
}

declare global {
  interface Window {
    grecaptcha?: GoogleRecaptcha;
  }
}

export interface RecaptchaHandle {
  /** Clears the checkbox and the token. Tokens can only be used once, so call this after each check. */
  reset: () => void;
}

interface RecaptchaFieldProps {
  onChange: (token: string | null) => void;
  theme?: 'light' | 'dark';
}

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
const SCRIPT_URL = 'https://www.google.com/recaptcha/api.js?render=explicit';

let scriptPromise: Promise<void> | null = null;

/** Loads Google's reCAPTCHA script once, no matter how many times the field mounts. */
function loadRecaptchaScript(): Promise<void> {
  if (window.grecaptcha?.render) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('reCAPTCHA script failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Google reCAPTCHA v2 checkbox. The token it produces is verified on the server before sign-in. */
export const RecaptchaField = forwardRef<RecaptchaHandle, RecaptchaFieldProps>(function RecaptchaField(
  { onChange, theme = 'light' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!SITE_KEY) {
      setError('Security check is not configured. Add VITE_RECAPTCHA_SITE_KEY to the app settings.');
      return;
    }
    let cancelled = false;

    loadRecaptchaScript()
      .then(() => {
        if (cancelled || widgetId.current !== null || !containerRef.current || !window.grecaptcha) return;
        window.grecaptcha.ready(() => {
          if (cancelled || widgetId.current !== null || !containerRef.current || !window.grecaptcha) return;
          widgetId.current = window.grecaptcha.render(containerRef.current, {
            sitekey: SITE_KEY,
            theme,
            callback: (token: string) => {
              setError(null);
              onChangeRef.current(token);
            },
            'expired-callback': () => onChangeRef.current(null),
            'error-callback': () => {
              onChangeRef.current(null);
              setError("The security check couldn't load. Check your connection and try again.");
            },
          });
        });
      })
      .catch(() => {
        if (!cancelled) setError("The security check couldn't load. Check your connection and try again.");
      });

    return () => {
      cancelled = true;
    };
    // The widget renders once per mount; theme is fixed on the login screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current !== null && window.grecaptcha) window.grecaptcha.reset(widgetId.current);
      onChangeRef.current(null);
    },
  }));

  return (
    <div className="flex flex-col items-center">
      <div ref={containerRef} className="flex min-h-[78px] max-w-full items-center justify-center" />
      {error && <p role="alert" className="mt-2 text-center text-xs text-error">{error}</p>}
    </div>
  );
});
