import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, Calendar as CalendarIcon, Plus } from '../../icons';
import { errorMessage } from '../../lib/format';
import { dayLabel, timeLabel } from '../../lib/calendarDates';
import { listUpcomingEvents } from '../../services/calendar';
import { reminderLabel } from '../calendar/EventEditor';
import type { CalendarEvent } from '../../types/database';
import { Card } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { Alert } from '../common/Forms';
import { Skeleton } from '../common/Skeleton';

interface NextUpCardProps {
  userId: string;
  onEdit: (event: CalendarEvent) => void;
  onAdd: () => void;
}

/** The next few events with their reminder settings. */
export function NextUpCard({ userId, onEdit, onAdd }: NextUpCardProps) {
  const query = useQuery({
    queryKey: ['calendar-upcoming', userId, 4],
    queryFn: () => listUpcomingEvents(userId, 4),
    enabled: !!userId,
  });
  const events = query.data ?? [];

  return (
    <Card
      title="Next up"
      description="Upcoming events and reminders"
      action={
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add
        </button>
      }
    >
      {query.isLoading && <Skeleton className="h-24 w-full" />}
      {query.isError && <Alert>{errorMessage(query.error)}</Alert>}

      {query.data && events.length === 0 && (
        <EmptyState icon={CalendarIcon} title="Nothing coming up" description="Add an event and set a reminder so you don't miss it." />
      )}

      {events.length > 0 && (
        <ul className="divide-y divide-border">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onEdit(event)}
                className="flex w-full items-start gap-3 rounded-control px-2 py-2.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <div className="w-16 shrink-0 text-xs">
                  <p className="font-semibold">{dayLabel(new Date(event.starts_at))}</p>
                  <time dateTime={event.starts_at} className="text-muted">{timeLabel(event.starts_at)}</time>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  {event.reminder_minutes !== null ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
                      <Bell className="h-3 w-3" aria-hidden /> {reminderLabel(event.reminder_minutes)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted">No reminder</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Link to="/calendar" className="mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline">
        Open calendar
      </Link>
    </Card>
  );
}
