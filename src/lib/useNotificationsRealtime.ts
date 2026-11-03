import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useToast } from '../components/common/Toast';
import { describeNotifications } from '../services/social';
import { notificationMessage } from './notifications';
import type { AppNotification } from '../types/database';

/**
 * Listens for new notifications for the signed-in user. Refreshes the bell and the
 * notifications list, and shows a toast. Polling in AppShell remains as a fallback.
 */
export function useNotificationsRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        async (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
          queryClient.invalidateQueries({ queryKey: ['notifications-unread', userId] });
          try {
            const [described] = await describeNotifications([payload.new as AppNotification]);
            if (described) toast(notificationMessage(described).text, 'info');
          } catch {
            toast('You have a new notification', 'info');
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, toast]);
}
