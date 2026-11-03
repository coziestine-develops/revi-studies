import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const SUBMIT_GRACE_MS = 15000;

// Grades a quiz attempt on the server. Answer keys never leave this function until submission.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.', code: 'METHOD' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Please sign in again.', code: 'UNAUTHORIZED' }, 401);

  let body: { attemptId?: unknown; answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.', code: 'BAD_REQUEST' }, 400);
  }
  if (typeof body.attemptId !== 'string' || !Array.isArray(body.answers) || body.answers.length > 300) {
    return json({ error: 'attemptId and a list of answers are required.', code: 'BAD_REQUEST' }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: attempt } = await admin
    .from('quiz_attempts')
    .select('id, quiz_id, user_id, submitted_at, started_at')
    .eq('id', body.attemptId)
    .maybeSingle();
  if (!attempt || attempt.user_id !== user.id) return json({ error: 'Attempt not found.', code: 'NOT_FOUND' }, 404);
  if (attempt.submitted_at) return json({ error: 'This attempt was already submitted.', code: 'ALREADY_SUBMITTED' }, 409);

  // Re-check access with the user's own permissions so a revoked share can't be used to submit.
  const { data: visible } = await userClient.from('quizzes').select('id').eq('id', attempt.quiz_id).maybeSingle();
  if (!visible) return json({ error: 'You no longer have access to this quiz.', code: 'FORBIDDEN' }, 403);

  const { data: quiz } = await admin
    .from('quizzes')
    .select('id, show_explanations_after, time_limit_seconds')
    .eq('id', attempt.quiz_id)
    .single();

  // Enforce the time limit on the server. The browser timer alone can be bypassed.
  // A short grace period covers network delay for answers submitted right at the deadline.
  if (quiz?.time_limit_seconds) {
    const deadline = new Date(attempt.started_at).getTime() + quiz.time_limit_seconds * 1000 + SUBMIT_GRACE_MS;
    if (Date.now() > deadline) {
      // Close the attempt without a score so it can't be retried with more time.
      await admin
        .from('quiz_attempts')
        .update({ submitted_at: new Date().toISOString(), score: null, total: null })
        .eq('id', attempt.id)
        .is('submitted_at', null);
      return json({
        error: 'Time ran out before this quiz was submitted, so this attempt was not scored.',
        code: 'TIME_EXPIRED',
      }, 410);
    }
  }
  const { data: questions } = await admin
    .from('quiz_questions')
    .select('id, options, position')
    .eq('quiz_id', attempt.quiz_id)
    .order('position', { ascending: true });
  const questionIds = (questions ?? []).map((q) => q.id);
  const { data: keys } = await admin
    .from('quiz_answer_keys')
    .select('question_id, correct_answer, explanation')
    .in('question_id', questionIds);

  const keyById = new Map((keys ?? []).map((k) => [k.question_id, k]));
  const answerById = new Map<string, string | null>();
  for (const item of body.answers as { questionId?: unknown; selected?: unknown }[]) {
    if (typeof item?.questionId === 'string' && questionIds.includes(item.questionId)) {
      answerById.set(item.questionId, typeof item.selected === 'string' ? item.selected : null);
    }
  }

  const graded = (questions ?? []).map((q) => {
    const options: string[] = Array.isArray(q.options) ? q.options : [];
    let selected = answerById.get(q.id) ?? null;
    if (selected !== null && !options.includes(selected)) selected = null;
    const key = keyById.get(q.id);
    return { q, key, selected, correct: !!key && selected === key.correct_answer };
  });
  const score = graded.filter((g) => g.correct).length;
  const total = graded.length;

  // Claim the attempt atomically so a double submit can't grade twice.
  const { data: claimed, error: claimError } = await admin
    .from('quiz_attempts')
    .update({ score, total, submitted_at: new Date().toISOString() })
    .eq('id', attempt.id)
    .is('submitted_at', null)
    .select('id');
  if (claimError) return json({ error: 'Could not save your score. Please try again.', code: 'SAVE_FAILED' }, 500);
  if (!claimed || claimed.length === 0) return json({ error: 'This attempt was already submitted.', code: 'ALREADY_SUBMITTED' }, 409);

  const { error: answersError } = await admin.from('quiz_answers').upsert(
    graded.map((g) => ({
      attempt_id: attempt.id,
      question_id: g.q.id,
      selected_answer: g.selected,
      is_correct: g.correct,
    })),
    { onConflict: 'attempt_id,question_id' },
  );
  if (answersError) console.error('quiz_answers save failed', answersError.message);

  const reveal = quiz?.show_explanations_after ?? true;
  return json({
    score,
    total,
    results: graded.map((g) => ({
      questionId: g.q.id,
      selected: g.selected,
      correct: g.correct,
      correctAnswer: reveal ? g.key?.correct_answer ?? null : undefined,
      explanation: reveal ? g.key?.explanation ?? null : undefined,
    })),
  });
});
