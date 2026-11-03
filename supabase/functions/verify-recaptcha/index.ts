const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Checks a Google reCAPTCHA token on the server. The secret key never reaches the browser.
// Deploy with: supabase functions deploy verify-recaptcha --no-verify-jwt
// Set the secret with: supabase secrets set RECAPTCHA_SECRET_KEY=...
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.', code: 'METHOD' }, 405);

  const secret = Deno.env.get('RECAPTCHA_SECRET_KEY');
  if (!secret) {
    console.error('RECAPTCHA_SECRET_KEY is not set.');
    return json({ error: 'The security check is not configured yet.', code: 'NOT_CONFIGURED' }, 500);
  }

  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.', code: 'BAD_REQUEST' }, 400);
  }
  if (typeof body.token !== 'string' || body.token.length === 0 || body.token.length > 4096) {
    return json({ error: 'Please complete the security check.', code: 'MISSING_TOKEN' }, 400);
  }

  const form = new URLSearchParams({ secret, response: body.token });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip) form.set('remoteip', ip);

  let result: { success?: boolean; 'error-codes'?: string[] };
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: form });
    result = await response.json();
  } catch (err) {
    console.error('reCAPTCHA verification request failed', err);
    return json({ error: "Couldn't reach the security check. Try again.", code: 'VERIFY_UNAVAILABLE' }, 502);
  }

  if (!result.success) {
    console.warn('reCAPTCHA rejected a token', result['error-codes']);
    return json({ error: 'The security check failed. Please try again.', code: 'RECAPTCHA_FAILED' }, 403);
  }
  return json({ success: true });
});
