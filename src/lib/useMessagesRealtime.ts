import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * Refreshes message lists and unread counts when a message is sent to or from the
 * signed-in user. Row-level security limits events to that user's own conversations.
 */
export function useMessagesRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['messages', userId] });
      queryClient.invalidateQueries({ queryKey: ['messages-unread', userId] });
    };

    const channel = supabase
      .channel(`messages:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${userId}` }, refresh)
      // Unsent messages are updates, and "Remove for me" adds a hide row. Both refresh the list.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_message_hides', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
