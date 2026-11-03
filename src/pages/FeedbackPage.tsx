import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, Star } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/common/Toast';
import { displayName } from '../lib/user';
import { errorMessage } from '../lib/format';
import { FEEDBACK_CATEGORIES, feedbackConfigured, sendFeedback } from '../services/feedback';
import { Card } from '../components/common/Card';
import { Alert, Field, inputClass } from '../components/common/Forms';
import { Button } from '../components/common/Button';

const MAX_LENGTH = 1500;
const COOLDOWN_MS = 30_000;
const COOLDOWN_KEY = 'revi-feedback-last-sent';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email: z.string().trim().email('Enter a valid email address.'),
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters).').max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters.`),
  website: z.string().max(0).optional(), // honeypot: real people never fill this in
});
type FormValues = z.infer<typeof schema>;

function secondsLeft(): number {
  try {
    const last = Number(window.localStorage.getItem(COOLDOWN_KEY) ?? 0);
    return Math.max(0, Math.ceil((last + COOLDOWN_MS - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState<number>(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: displayName(user), email: user?.email ?? '', category: 'Suggestion', message: '', website: '' },
  });
  const category = watch('category');
  const length = watch('message')?.length ?? 0;

  async function onSubmit(values: FormValues) {
    setError(null);
    setSent(false);
    if (values.website) return; // bot
    const wait = secondsLeft();
    if (wait > 0) {
      setError(`Please wait ${wait}s before sending another message.`);
      return;
    }
    try {
      await sendFeedback({
        name: values.name,
        email: values.email,
        category: values.category,
        rating: rating || null,
        message: values.message,
        userId: user?.id ?? '',
      });
      try {
        window.localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      } catch {
        // Storage may be blocked; the message was still sent.
      }
      reset({ ...values, message: '', website: '' });
      setRating(0);
      setSent(true);
      toast('Thanks! Your feedback was sent.', 'success');
    } catch (err) {
      setError(`Couldn't send your feedback. ${errorMessage(err)}`);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Feedback</h1>
        <p className="mt-1 text-sm text-muted">Found a bug, have an idea, or just want to say something nice? Every message is read.</p>
      </header>

      <Card>
        {!feedbackConfigured && (
          <div className="mb-5">
            <Alert tone="info">Feedback email isn't set up yet. Add the EmailJS keys from SETUP.md to your .env file, then restart the dev server.</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">What kind of feedback is it?</legend>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_CATEGORIES.map((item) => (
                <label
                  key={item}
                  className={`cursor-pointer rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-brand ${
                    category === item ? 'border-brand bg-primary text-primary-foreground' : 'border-border text-muted hover:bg-surface-muted hover:text-foreground'
                  }`}
                >
                  <input type="radio" value={item} {...register('category')} className="sr-only" />
                  {item}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <p id="rating-label" className="mb-1.5 text-sm font-medium">How is your experience with REVI? <span className="font-normal text-muted">(optional)</span></p>
            <div role="radiogroup" aria-labelledby="rating-label" className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} out of 5`}
                  onClick={() => setRating(rating === value ? 0 : value)}
                  className="rounded-md p-1 text-border transition-colors hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Star className={`h-6 w-6 ${value <= rating ? 'fill-warning text-warning' : ''}`} aria-hidden />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="fb-name" label="Name" error={errors.name?.message}>
              <input id="fb-name" autoComplete="name" aria-invalid={!!errors.name} className={inputClass} {...register('name')} />
            </Field>
            <Field id="fb-email" label="Email" error={errors.email?.message} hint="So we can reply if needed.">
              <input id="fb-email" type="email" autoComplete="email" aria-invalid={!!errors.email} className={inputClass} {...register('email')} />
            </Field>
          </div>

          <Field id="fb-message" label="Message" error={errors.message?.message}>
            <textarea
              id="fb-message"
              rows={6}
              maxLength={MAX_LENGTH}
              placeholder="What's on your mind?"
              aria-invalid={!!errors.message}
              className={`${inputClass} resize-y`}
              {...register('message')}
            />
            <p className="mt-1 text-right text-xs text-muted">{length}/{MAX_LENGTH}</p>
          </Field>

          {/* Honeypot field, hidden from people and assistive tech. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Website<input tabIndex={-1} autoComplete="off" {...register('website')} /></label>
          </div>

          {error && <Alert tone="error">{error}</Alert>}
          {sent && <Alert tone="success">Thanks for helping make REVI better. Your feedback was sent.</Alert>}

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!feedbackConfigured}>
              <Send className="h-4 w-4" aria-hidden /> Send feedback
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
