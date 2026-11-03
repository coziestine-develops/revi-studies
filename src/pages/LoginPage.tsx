import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, EyeOff, GoogleIcon, KeyRound, Layers, Mail, Sparkles, TrendingUp, User } from '../icons';
import type { IconComponent } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { useForcedDarkTheme } from '../contexts/ThemeContext';
import { Button } from '../components/common/Button';
import { Alert } from '../components/common/Forms';
import { RecaptchaField, type RecaptchaHandle } from '../components/auth/RecaptchaField';
import { invokeFunction, FunctionError } from '../lib/functions';

const schema = z.object({
  fullName: z.string().trim().max(100, 'Keep your name under 100 characters.').optional(),
  email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type FormValues = z.infer<typeof schema>;
type Mode = 'signin' | 'signup';

const inputClass =
  'w-full rounded-control border border-border bg-surface-muted py-3.5 pl-10 pr-3.5 text-base text-foreground lg:py-3 lg:text-sm placeholder:text-muted focus:border-lavender focus:outline-none focus:ring-2 focus:ring-brand aria-[invalid=true]:border-error';

function InputField({ id, label, icon: Icon, error, action, children }: {
  id: string;
  label: string;
  icon: IconComponent;
  error?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        {action}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        {children}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-error">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  useForcedDarkTheme();
  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaHandle>(null);

  // OAuth errors come back in the URL. Show them instead of failing silently.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, '?'));
    const description = params.get('error_description') ?? params.get('error');
    if (description) {
      setServerError(description.replace(/\+/g, ' '));
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  if (user) return <Navigate to="/dashboard" replace />;

  function switchMode(next: Mode) {
    setMode(next);
    setServerError(null);
    setNotice(null);
    reset({ fullName: '', email: '', password: '' });
  }

  async function handleGoogle() {
    setServerError(null);
    setNotice(null);
    setGoogleBusy(true);
    try {
      // No timeout here: the Google popup stays open until the student finishes choosing an account.
      // Cancelling the popup returns null, and the page simply stays put.
      const error = await signInWithGoogle();
      if (error) setServerError(error);
    } catch {
      setServerError('Google sign-in could not start. Try again.');
    } finally {
      setGoogleBusy(false);
    }
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setNotice(null);

    if (!captchaToken) {
      setServerError('Please complete the security check first.');
      return;
    }

    // Verify the reCAPTCHA token on the server before any credentials are checked.
    // Tokens are single-use, so the checkbox resets right away and must be completed again after a failed attempt.
    try {
      await invokeFunction<{ success: boolean }>('verify-recaptcha', { token: captchaToken });
    } catch (err) {
      recaptchaRef.current?.reset();
      setServerError(err instanceof FunctionError ? err.message : 'The security check failed. Please try again.');
      return;
    }
    recaptchaRef.current?.reset();

    if (mode === 'signin') {
      const error = await signIn(values.email, values.password);
      if (error) setServerError(error);
      else navigate(from, { replace: true });
      return;
    }

    const error = await signUp(values.email, values.password, values.fullName ?? '');
    if (error) {
      setServerError(error);
      return;
    }
    setMode('signin');
    setNotice('Account created. Check your email to verify it, then sign in.');
    reset({ fullName: '', email: values.email, password: '' });
  };

  const isSignin = mode === 'signin';

  const perks = [
    { icon: Sparkles, title: 'AI study tools', text: 'Summaries and practice material from your own reviewers.' },
    { icon: Layers, title: 'Flashcards and quizzes', text: 'Turn passive reading into active recall.' },
    { icon: TrendingUp, title: 'Progress you can see', text: 'Streaks, goals, and weekly activity in one place.' },
  ];

  return (
    <main className="dark flex min-h-[100dvh] flex-col bg-background text-foreground lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Desktop: brand panel */}
      <aside className="relative hidden flex-col items-start justify-start gap-12 overflow-hidden bg-[linear-gradient(160deg,rgb(var(--revi-soft-navy)),rgb(var(--revi-midnight)))] px-12 pb-12 pt-10 text-[rgb(var(--revi-cream))] lg:flex xl:px-16 xl:pb-16 xl:pt-12">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[rgb(var(--revi-lavender)/0.25)] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[rgb(var(--revi-gold)/0.12)] blur-3xl" />

        <Link
          to="/"
          className="group relative inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[rgb(var(--revi-cream)/0.1)] px-5 text-sm font-semibold text-[rgb(var(--revi-cream))] ring-1 ring-[rgb(var(--revi-cream)/0.20)] backdrop-blur transition-colors hover:bg-[rgb(var(--revi-cream)/0.18)] hover:ring-[rgb(var(--revi-cream)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--revi-lavender))]"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" aria-hidden />
          Back to home
        </Link>

        <div className="relative my-auto">
          <img src="/revi-mascot.png" alt="" aria-hidden className="mb-8 h-44 w-auto object-contain drop-shadow-xl xl:h-56" />
          <h2 className="max-w-md text-4xl font-extrabold leading-[1.15] tracking-tight xl:text-5xl">
            Your notes. Your pace. <span className="text-[rgb(var(--revi-gold))]">Your progress.</span>
          </h2>
          <ul className="mt-10 max-w-md space-y-5">
            {perks.map((perk) => (
              <li key={perk.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-[rgb(var(--revi-cream)/0.1)] ring-1 ring-[rgb(var(--revi-cream)/0.15)]">
                  <perk.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-bold">{perk.title}</p>
                  <p className="text-sm leading-relaxed opacity-75">{perk.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

      </aside>

      {/* Mobile: compact brand header */}
      <header className="relative overflow-hidden bg-[radial-gradient(120%_80%_at_100%_0%,rgb(var(--revi-lavender)/0.22)_0%,transparent_55%),linear-gradient(180deg,rgb(var(--revi-soft-navy))_0%,rgb(var(--revi-midnight))_100%)] px-5 pb-14 pt-5 text-[rgb(var(--revi-cream))] lg:hidden">
        <Link to="/" className="relative inline-flex h-10 items-center gap-1.5 rounded-full bg-[rgb(var(--revi-cream)/0.1)] px-3.5 text-sm font-semibold ring-1 ring-[rgb(var(--revi-cream)/0.15)]">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Home
        </Link>
        <div className="relative mt-5 flex items-center gap-4">
          <img src="/revi-avatar.png" alt="REVI" width={64} height={64} className="h-16 w-16 shrink-0 rounded-full bg-lavender-surface object-cover ring-2 ring-[rgb(var(--revi-cream)/0.20)]" />
          <div>
            <p className="font-display text-2xl font-extrabold tracking-tight">REVI</p>
            <p className="text-sm opacity-80">Review smarter. Learn better. Together.</p>
          </div>
        </div>
      </header>

      {/* Form: a bottom sheet on phones, a clean centered column on desktop */}
      <section className="relative -mt-7 flex flex-1 flex-col rounded-t-[1.75rem] bg-surface px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 shadow-[0_-4px_16px_rgb(var(--overlay)/0.12)] sm:mx-auto sm:w-full sm:max-w-md sm:px-8 lg:mx-0 lg:mt-0 lg:max-w-none lg:items-center lg:justify-center lg:rounded-none lg:bg-transparent lg:px-12 lg:py-12 lg:shadow-none">
        <div className="w-full lg:max-w-md">
          <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight lg:text-4xl">
            {isSignin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted lg:mt-2 lg:text-base">
            {isSignin ? 'Sign in to pick up where you left off.' : 'Start organizing your reviewers in minutes.'}
          </p>

          <div className="mt-6 flex flex-col lg:mt-8">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {!isSignin && (
                <InputField id="fullName" label="Full name" icon={User} error={errors.fullName?.message}>
                  <input
                    id="fullName"
                    autoComplete="name"
                    placeholder="Enter your name"
                    className={inputClass}
                    aria-invalid={!!errors.fullName}
                    {...register('fullName')}
                  />
                </InputField>
              )}

              <InputField id="email" label="Email" icon={Mail} error={errors.email?.message}>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  className={inputClass}
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
              </InputField>

              <InputField
                id="password"
                label="Password"
                icon={KeyRound}
                error={errors.password?.message}
                action={isSignin ? (
                  <Link to="/forgot-password" className="text-xs font-semibold text-lavender hover:underline">Forgot password?</Link>
                ) : undefined}
              >
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignin ? 'current-password' : 'new-password'}
                  placeholder={isSignin ? 'Enter your password' : 'Create a password'}
                  className={`${inputClass} pr-11`}
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-control p-2 text-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </InputField>

              <div className="flex justify-center max-[359px]:[zoom:0.9]">
                <RecaptchaField ref={recaptchaRef} theme="dark" onChange={setCaptchaToken} />
              </div>

              {serverError && <Alert>{serverError}</Alert>}
              {notice && <Alert tone="success">{notice}</Alert>}

              <Button
                type="submit"
                className="h-12 w-full text-base font-bold lg:h-11 lg:text-sm"
                loading={isSubmitting}
                disabled={!captchaToken}
              >
                {isSubmitting ? 'Please wait…' : isSignin ? 'Sign in' : 'Create account'}
              </Button>
              {!captchaToken && !isSubmitting && (
                <p className="-mt-2 text-center text-xs text-muted">Complete the security check to sign in.</p>
              )}
            </form>

            <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="secondary" className="h-12 w-full text-sm font-semibold lg:h-11" onClick={handleGoogle} loading={googleBusy} disabled={isSubmitting}>
              {!googleBusy && <GoogleIcon className="h-4 w-4" />}
              Continue with Google
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            {isSignin ? 'New to REVI?' : 'Already have an account?'}{' '}
            <button type="button" onClick={() => switchMode(isSignin ? 'signup' : 'signin')} className="font-bold text-lavender hover:underline">
              {isSignin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}