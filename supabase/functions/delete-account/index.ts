import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Deletes the signed-in user's auth record. Database rows cascade from auth.users.
// Storage objects for owned reviewers are removed first, since storage isn't covered by cascades.
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

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: owned, error: ownedError } = await admin.from('reviewers').select('id').eq('owner_id', user.id);
  if (ownedError) return json({ error: 'Could not prepare account deletion.', code: 'FAILED' }, 500);

  const reviewerIds = (owned ?? []).map((r) => r.id);
  if (reviewerIds.length > 0) {
    const { data: files } = await admin.from('reviewer_files').select('storage_path').in('reviewer_id', reviewerIds);
    const paths = (files ?? []).map((f) => f.storage_path);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from('revi-reviewers').remove(paths.slice(i, i + 100));
      if (error) return json({ error: 'Could not remove your stored files. Account not deleted.', code: 'FAILED' }, 500);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: 'Could not delete the account. Please try again.', code: 'FAILED' }, 500);
  return json({ ok: true });
});
