# REVI

REVI helps students organize reviewers, generate study tools with AI, practice with flashcards and quizzes, and track their progress.

## Features

- **Reviewers:** upload PDF, Word, PowerPoint, and image files, or capture a page with the camera. View files in the app.
- **AI tools:** generate summaries, flashcards, and quizzes from your reviewers, and chat with a study assistant.
- **Flashcards and quizzes:** study decks and take quizzes graded on the server.
- **Study history and analytics:** see past sessions and track progress over time.
- **Collections:** group reviewers together.
- **Friends, messages, and calendar:** share reviewers with friends, message them, and add calendar events with reminders.
- **Notifications:** in-app alerts for shared reviewers and messages, delivered live.
- **Feedback:** send feedback from inside the app.
- **Themes:** light and dark mode.

## Tech stack

- React 18, TypeScript, Vite
- Tailwind CSS, Font Awesome
- React Router, TanStack Query, React Hook Form with Zod
- Supabase for authentication, Postgres with row-level security, storage, realtime, and Edge Functions
- Groq for AI generation (optional)
- pdf.js, Mammoth, and JSZip for reading documents
- Recharts and Framer Motion for charts and motion

## Project structure

```
src/
  components/   Reusable UI and feature components (auth, common, dashboard, layout, ...)
  contexts/     Auth and theme providers
  lib/          Supabase client, helpers, realtime hooks
  pages/        One file per route
  services/     Data access functions for each feature
  schemas/      Form validation schemas
supabase/
  schema/       Full database schema (run this on a new project)
  migrations/   Incremental database changes
  functions/    Edge Functions (AI, quiz grading, account deletion, reCAPTCHA)
public/         Static assets, including the REVI mascot and favicon
```

## Getting started

Requirements: Node.js 18 or newer, and a Supabase project.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment file and fill in your values:
   ```bash
   cp .env.example .env
   ```
   Use only the Supabase project URL and publishable key in the frontend. Never add a service-role key.
3. Start the development server:
   ```bash
   npm run dev
   ```
   The app runs at `http://localhost:5173`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Your Supabase publishable key |
| `VITE_RECAPTCHA_SITE_KEY` | No | Google reCAPTCHA v2 site key |
| `VITE_EMAILJS_SERVICE_ID` | No | EmailJS service for the feedback form |
| `VITE_EMAILJS_TEMPLATE_ID` | No | EmailJS template for the feedback form |
| `VITE_EMAILJS_PUBLIC_KEY` | No | EmailJS public key |

Any variable starting with `VITE_` is included in the browser bundle, so keep secrets out of it.

## Database setup

Run one file in the Supabase SQL Editor, as the postgres role:

- `supabase/schema/revi_schema_v4.sql` for a new project, or a project with no REVI tables yet.

If you already ran the older v2 schema and migrations 002 to 006, run `supabase/migrations/007_messages_and_calendar.sql` instead. Then run `supabase/migrations/010_messenger_message_actions.sql`. Migrations are safe to run more than once.

## Edge Functions

Deploy the functions with the Supabase CLI from the project root:

```bash
supabase functions deploy grade-quiz
supabase functions deploy generate-study-content
supabase functions deploy delete-account
supabase functions deploy ai-chat
```

## AI tools (optional)

AI features use Groq. Without a key, the AI page shows a setup message and generates nothing.

```bash
supabase secrets set GROQ_API_KEY=your-groq-key GROQ_MODEL=openai/gpt-oss-120b
```

## Authentication settings

In Supabase, go to **Authentication > URL Configuration**:

- **Site URL:** `http://localhost:5173` for local development, or your production URL.
- **Redirect URLs:** add `http://localhost:5173/reset-password` and `http://localhost:5173/login`, plus the production equivalents.

## Feedback form (EmailJS)

1. Create an email service and a template at emailjs.com.
2. In the template, set the **To email** and use these variables: `{{category}}`, `{{rating}}`, `{{message}}`, `{{from_name}}`, `{{from_email}}`, `{{user_id}}`, `{{sent_at}}`, `{{page_url}}`. Set **Reply-To** to `{{reply_to}}`.
3. Add the three `VITE_EMAILJS_*` values to `.env` and restart the dev server.
4. In EmailJS, restrict the public key to your site's domain.

## Notifications

Run `supabase/migrations/005_live_notifications.sql` in the SQL Editor. It notifies people when a shared reviewer changes and publishes notifications to Supabase Realtime. Notifications are in-app only; email delivery is not set up.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Typecheck and build for production into `dist/` |
| `npm run typecheck` | Run the TypeScript checker only |
| `npm run preview` | Serve the production build locally |

## Deployment

The app is a static Vite build. Run `npm run build` and deploy the `dist/` folder to any static host. Set the `VITE_*` variables in your host's settings. Configure client-side routing so that refreshing a route like `/dashboard` serves `index.html`, and add your production URL to the Supabase authentication settings.

## Security notes

- Row-level security protects all data, so the publishable key is safe in the browser.
- Keep service-role keys and API keys (such as `GROQ_API_KEY`) in Supabase secrets, never in `.env` or any `VITE_` variable.
