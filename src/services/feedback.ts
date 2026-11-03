/**
 * Sends feedback through EmailJS's REST API, so no extra package is needed.
 * The service ID, template ID, and public key are browser-safe values from your EmailJS dashboard.
 */
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const feedbackConfigured = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

export const FEEDBACK_CATEGORIES = ['Suggestion', 'Bug', 'Praise', 'Other'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface FeedbackPayload {
  name: string;
  email: string;
  category: FeedbackCategory;
  rating: number | null;
  message: string;
  userId: string;
}

export async function sendFeedback(payload: FeedbackPayload): Promise<void> {
  if (!feedbackConfigured) throw new Error('Feedback sending is not set up yet.');

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: PUBLIC_KEY,
      template_params: {
        from_name: payload.name,
        from_email: payload.email,
        reply_to: payload.email,
        category: payload.category,
        rating: payload.rating ? `${payload.rating} / 5` : 'Not rated',
        message: payload.message,
        user_id: payload.userId,
        page_url: window.location.origin,
        sent_at: new Date().toLocaleString(),
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 160);
    throw new Error(detail || `EmailJS responded with status ${response.status}.`);
  }
}
