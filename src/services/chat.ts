import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/functions';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reviewer_id: string | null;
  created_at: string;
}

export async function listChatMessages(userId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, reviewer_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    // PostgREST reports a missing table with PGRST205 or a schema cache message
    if (error.code === 'PGRST205' || /schema cache|could not find the table/i.test(error.message)) {
      throw new Error(
        "Study chat isn't set up in this Supabase project yet. Run supabase/migrations/003_ai_chat.sql in the SQL Editor, then refresh this page.",
      );
    }
    throw error;
  }
  return (data ?? []) as ChatMessage[];
}

export function sendChatMessage(message: string, reviewerId?: string): Promise<{ reply: string }> {
  return invokeFunction<{ reply: string }>('ai-chat', { message, reviewerId });
}

export async function clearChat(userId: string): Promise<void> {
  const { error } = await supabase.from('ai_chat_messages').delete().eq('user_id', userId);
  if (error) throw error;
}
