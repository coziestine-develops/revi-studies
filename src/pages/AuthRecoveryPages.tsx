import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { friendlyAuthError } from '../lib/authErrors';
import { Logo } from '../components/common/Logo';
import { Button } from '../components/common/Button';
import { Alert, Field, PasswordInput, inputClass } from '../components/common/Forms';

const emailSchema = z.object({ email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.') });
const passwordSchema = z
  .object({
    password: z.string().min(6, 'Use at least 6 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match.', path: ['confirm'] });

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="text-center text-xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-center text-sm text-muted"><Link to="/login" className="underline">Back to sign in</Link></p>
      </div>
    </main>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });

  async function onSubmit({ email }: { email: string }) {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (resetError) setError(friendlyAuthError(resetError));
    else {
      setSent(true);
      setCooldown(60);
    }
  }

  return (
    <Shell title="Reset your password">
      {sent ? (
        <div className="space-y-4">
          <Alert tone="success">If an account exists for that email, a reset link is on its way. Check your inbox.</Alert>
          <Button variant="secondary" className="w-full" onClick={() => setSent(false)} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Send another link'}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <p className="text-sm text-muted">Enter your email and we'll send you a link to choose a new password.</p>
          <Field id="email" label="Email" error={errors.email?.message}>
            <input id="email" type="email" autoComplete="email" className={inputClass} aria-invalid={!!errors.email} {...register('email')} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" loading={isSubmitting} disabled={cooldown > 0}>
            {cooldown > 0 ? `Try again in ${cooldown}s` : 'Send reset link'}
          </Button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
      // Give the recovery code in the URL a moment to be exchanged before declaring the link invalid.
      window.setTimeout(() => active && setChecking(false), data.session ? 0 : 1500);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
        setChecking(false);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit({ password }: { password: string }) {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(friendlyAuthError(updateError));
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
  }

  return (
    <Shell title="Choose a new password">
      {done && <Alert tone="success">Password updated. Taking you to your dashboard…</Alert>}
      {!done && !ready && checking && <p className="text-sm text-muted" role="status">Checking your reset link…</p>}
      {!done && !ready && !checking && (
        <p className="text-sm text-muted">This reset link is invalid or has expired. <Link to="/forgot-password" className="underline">Request a new one</Link>.</p>
      )}
      {!done && ready && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field id="password" label="New password" error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="new-password" className={inputClass} aria-invalid={!!errors.password} {...register('password')} />
          </Field>
          <Field id="confirm" label="Confirm password" error={errors.confirm?.message}>
            <PasswordInput id="confirm" autoComplete="new-password" className={inputClass} aria-invalid={!!errors.confirm} {...register('confirm')} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button>
        </form>
      )}
    </Shell>
  );
}
