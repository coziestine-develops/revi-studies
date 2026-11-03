import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { processReminders, type FiredReminder } from '../services/calendar';

const CHECK_INTERVAL_MS = 30_000;

/** Shows a browser notification for each reminder, if the person has allowed them. */
function showBrowserAlerts(reminders: FiredReminder[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  for (const reminder of reminders) {
    const when = new Date(reminder.startsAt).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    new Notification(`Reminder: ${reminder.title}`, { body: `Starts ${when}`, tag: reminder.id });
  }
}

/**
 * Checks for due calendar reminders while the app is open. Runs on load, every 30 seconds,
 * and when the tab becomes visible again. The in-app notification and toast come from the
 * realtime listener, so this hook only refreshes the data and triggers browser alerts.
 */
export function useEventReminders(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function check() {
      try {
        const fired = await processReminders();
        if (cancelled || fired.length === 0) return;
        queryClient.invalidateQueries({ queryKey: ['calendar', userId] });
        queryClient.invalidateQueries({ queryKey: ['calendar-upcoming', userId] });
        queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread', userId] });
        showBrowserAlerts(fired);
      } catch (err) {
        // Stay quiet on each tick, but leave one trace so a missing migration is easy to spot.
        console.warn('Calendar reminders are not available yet:', err instanceof Error ? err.message : err);
      }
    }

    void check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, queryClient]);
}
