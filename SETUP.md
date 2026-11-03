# REVI setup

## 1. Database
Run **one file** in the Supabase SQL Editor, as the postgres role:
- `supabase/schema/revi_schema_v4.sql`. It creates every table, policy, trigger, storage bucket, and every feature, including messages, the calendar with reminders, and live notifications.

Use this for a new project, or one with no REVI tables yet. If you already ran the older v2 schema and migrations 002 to 006, run `supabase/migrations/007_messages_and_calendar.sql` instead of the schema file.

### Message actions (run once more)
Run `supabase/migrations/010_messenger_message_actions.sql` in the SQL Editor after the steps above. It adds reply, unsend, and "Remove for me" to messages. It is safe to run more than once and doesn't remove existing messages.

## 2. Frontend
```bash
npm install
npm run dev
```
Your `.env` must contain the project URL and publishable key. Never add a service-role key.

## 3. Edge Functions
Deploy with the Supabase CLI, from the project root:
```bash
supabase functions deploy grade-quiz
supabase functions deploy generate-study-content
supabase functions deploy delete-account
supabase functions deploy ai-chat
```

## 4. AI provider (optional)
AI tools use Groq. Get a free key from console.groq.com, then set it as a secret. AI tools stay disabled until you do:
```bash
supabase secrets set GROQ_API_KEY=your-groq-key GROQ_MODEL=openai/gpt-oss-120b
```
Until then, the AI page shows a setup message and nothing is generated.

## 5. Auth settings
In Supabase: Authentication > URL Configuration
- Site URL: `http://localhost:5173` for local development, your production URL when deployed
- Redirect URLs: add `http://localhost:5173/reset-password` and `http://localhost:5173/login`

## Feedback form (EmailJS)
The Feedback page (`/feedback`) sends messages to your inbox through EmailJS.
1. At emailjs.com, add an email service (for example Gmail) and create a template.
2. In the template, set the **To email** to the address that should receive feedback, and use these variables in the subject and body:
   `{{category}}`, `{{rating}}`, `{{message}}`, `{{from_name}}`, `{{from_email}}`, `{{user_id}}`, `{{sent_at}}`, `{{page_url}}`. Set **Reply-To** to `{{reply_to}}`.
3. Put the three values in `.env`, then restart `npm run dev`:
```
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_TEMPLATE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...
```
4. In EmailJS > Account > Security, restrict the public key to your site's domain to limit abuse.

## Notifications
Run `supabase/migrations/005_live_notifications.sql` in the SQL Editor. It is safe to run more than once. It:
- Notifies people when a shared reviewer is edited or gets a new file. The owner and everyone it's shared with are notified, except the person who made the change.
- Publishes the notifications table to Supabase Realtime, so new notifications appear without a page reload and show a toast.

Notifications are delivered in the app only. Email delivery isn't set up.

## File viewer
The Preview button opens a full-screen viewer for PDF, image, Word (.docx), PowerPoint (.pptx), and text files. PDFs are drawn with pdf.js, so they render on phones and desktops alike. Word and PowerPoint files show their text in the viewer. Download always gives the complete file. Viewer libraries are installed with `npm install`: pdfjs-dist, mammoth, and jszip.

## Text extraction
AI tools and study chat read the text in PDF, DOCX, PPTX, and plain text files. Extraction runs on the server in `supabase/functions/_shared/extract.ts`, which the generator and chat functions both import. Deploy all of these after pulling this update:
```bash
supabase functions deploy generate-study-content
supabase functions deploy ai-chat
supabase functions deploy grade-quiz
```
Limits to know about:
- Scanned PDFs and photos have no text layer, so they can't be read. Add a text version of the material or a description.
- Files that fail to extract are named in the error message so you can replace them.

## Quiz timers
The server enforces each quiz's time limit. Answers arriving more than 15 seconds after the limit are rejected, and that attempt is recorded as timed out with no score.

## Known gaps
- Manual quiz building isn't in the UI. Quizzes come from AI generation, because answer keys are kept server-side.

## Google sign-in (Firebase)
Google sign-in uses Firebase Auth. Firebase shows the Google account picker, then Supabase creates the REVI session from Google's ID token. Email sign-in and all data stay on Supabase.

1. Firebase console > Authentication > Sign-in method > Google: enable it and set a support email.
2. Firebase console > Authentication > Settings > Authorized domains: make sure `localhost` and your production domain are listed.
3. Firebase console > Authentication > Sign-in method > Google > Web SDK configuration: copy the **Web client ID** (it ends in `.apps.googleusercontent.com`).
4. Supabase > Authentication > Providers > Google: turn it on and paste that Web client ID into **Authorized Client IDs** (comma-separated if you already have others). The Client secret is not needed for this flow, but leaving the old one in place does no harm.
5. Put the Firebase web config in `.env` as `VITE_FIREBASE_*` (see `.env.example`). Restart the dev server after changing it.

Google users get a profile automatically. They can add a username under Settings.

## Fixing "email rate limit exceeded"
Supabase's built-in email sender allows only a few emails per hour per project. Sign-up confirmations and password resets both count against it.
- **Use custom SMTP:** Project Settings > Auth > SMTP settings. Connect a provider such as Resend, Brevo, SendGrid, or Postmark. This removes the built-in limit.
- **Raise the limit:** Authentication > Rate Limits, then raise "emails sent" for your SMTP provider.
- **During development only:** turn off "Confirm email" under Authentication > Sign In / Providers > Email. Accounts can then sign in immediately without verification. Turn it back on before launch.
- The app now shows a clear message when the limit is hit and makes users wait 60 seconds between reset requests.

## Google sign-in checklist (must match exactly)
- Firebase > Authentication > Sign-in method > Google: enabled.
- Firebase > Authentication > Settings > Authorized domains: includes `localhost` and your production domain.
- Supabase > Authentication > Providers > Google: enabled, and the Firebase **Web client ID** is in Authorized Client IDs.
- The `VITE_FIREBASE_*` values in `.env` match the Firebase web app config.
- If the button says "Google sign-in is not configured," the `VITE_FIREBASE_*` values are missing. If it says "Unacceptable audience" or "couldn't be linked," the Web client ID is missing from Supabase.

## Study chat
Deploy and run the new migration and function:
```bash
supabase db push   # or run supabase/migrations/003_ai_chat.sql in the SQL Editor
supabase functions deploy ai-chat
```
It uses the same `GROQ_API_KEY` secret as the other AI tools.

If the chat says it can't reach the function, the function isn't deployed yet. Run the deploy command above and check that the secret is set with `supabase secrets list`.

## Profile photos
Run `supabase/migrations/004_avatars.sql` in the SQL Editor. It creates the public `avatars` bucket and limits each user to their own folder.

## Fonts
The app loads Nunito (headings) and Inter (body text) from Google Fonts, so no install is needed.

## Login reCAPTCHA

The sign-in and sign-up forms require a Google reCAPTCHA v2 checkbox. The token is checked by the `verify-recaptcha` Edge Function before any credentials are sent to Supabase.

1. In the Google reCAPTCHA admin console, create a **v2 "I'm not a robot" Checkbox** key. Add your domains, including `localhost` for development.
2. Put the site key in `.env` (it is public):
   `VITE_RECAPTCHA_SITE_KEY=your-site-key`
3. Set the secret key on Supabase (never in `.env`):
   `supabase secrets set RECAPTCHA_SECRET_KEY=your-secret-key`
4. Deploy the function without JWT verification, since users call it before signing in:
   `supabase functions deploy verify-recaptcha --no-verify-jwt`

If the site key is missing, the sign-in button stays disabled and the form says the security check isn't configured.

## Messages and calendar
Run `supabase/migrations/007_messages_and_calendar.sql` in the SQL Editor, as the postgres role. It is safe to run more than once. It:
- Adds direct messages. Only accepted friends can message each other. Messages are live (no reload needed), and each conversation shows an unread count. Senders can delete their own messages.
- Adds a personal calendar at `/calendar`, with a month view, an upcoming list, and events that can have a reminder (at start time, 5 minutes to 1 day before).
- Turns reminders into notifications in the bell, with a toast when one fires.
- Sends a bell notification when a friend messages you. Each sender gets one unread alert at a time, which clears when you open the conversation. Run `supabase/migrations/008_message_notifications.sql` too (new projects using schema v4 already include it).

Reminders are checked while REVI is open: on load, every 30 seconds, and when the tab becomes visible again. If the person allows browser notifications on the Calendar page, a reminder also appears as a system notification. Nothing is sent when the app is closed, because email and push delivery aren't set up.

No new environment variables or Edge Functions are needed.
