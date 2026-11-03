import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { deleteEvent, listEventsBetween, listUpcomingEvents } from '../services/calendar';
import { errorMessage } from '../lib/format';
import { addDays, dayKey, startOfDay, startOfMonth } from '../lib/calendarDates';
import type { CalendarEvent } from '../types/database';
import { Card } from '../components/common/Card';
import { Alert } from '../components/common/Forms';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { PageHeader } from '../components/common/PageHeader';
import { Skeleton } from '../components/common/Skeleton';
import { EventEditor, EventList } from '../components/calendar/EventEditor';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


/** Six full weeks starting on the Sunday on or before the 1st, so the grid is always 42 cells. */
function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export default function CalendarPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [editor, setEditor] = useState<{ event: CalendarEvent | null; day: Date } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const days = useMemo(() => monthGrid(month), [month]);
  const gridStart = days[0];
  const gridEnd = addDays(days[days.length - 1], 1);

  const eventsQuery = useQuery({
    queryKey: ['calendar', userId, gridStart.toISOString()],
    queryFn: () => listEventsBetween(userId, gridStart.toISOString(), gridEnd.toISOString()),
    enabled: !!userId,
  });
  const upcomingQuery = useQuery({
    queryKey: ['calendar-upcoming', userId, 8],
    queryFn: () => listUpcomingEvents(userId, 8),
    enabled: !!userId,
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of eventsQuery.data ?? []) {
      const key = dayKey(new Date(event.starts_at));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [eventsQuery.data]);

  const dayEvents = eventsByDay.get(dayKey(selectedDay)) ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar', userId] });
    queryClient.invalidateQueries({ queryKey: ['calendar-upcoming', userId] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: refresh,
  });

  // Keep the selected day inside the month being viewed when the user changes months.
  useEffect(() => {
    if (selectedDay.getMonth() !== month.getMonth() || selectedDay.getFullYear() !== month.getFullYear()) {
      setSelectedDay(month);
    }
  }, [month, selectedDay]);

  async function enableBrowserAlerts() {
    if (typeof Notification === 'undefined') return;
    setNotifyPermission(await Notification.requestPermission());
  }

  const monthTitle = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayKey = dayKey(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Plan study sessions and deadlines. Set a reminder and REVI will alert you when it's time."
        actions={
          <Button onClick={() => setEditor({ event: null, day: selectedDay })}>
            <Plus className="h-4 w-4" aria-hidden /> New event
          </Button>
        }
      />

      {eventsQuery.isError && <Alert>Couldn't load your calendar: {errorMessage(eventsQuery.error)}</Alert>}
      {deleteMutation.isError && <Alert>{errorMessage(deleteMutation.error)}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="min-w-0 text-base font-semibold tracking-tight" aria-live="polite">{monthTitle}</h2>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={() => { const today = startOfDay(new Date()); setMonth(startOfMonth(today)); setSelectedDay(today); }}>Today</Button>
              <Button variant="ghost" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="ghost" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-control border border-border bg-border text-xs">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="bg-surface-muted py-2 text-center font-semibold text-muted">{weekday}</div>
            ))}
            {days.map((day) => {
              const key = dayKey(day);
              const events = eventsByDay.get(key) ?? [];
              const inMonth = day.getMonth() === month.getMonth();
              const selected = key === dayKey(selectedDay);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  aria-pressed={selected}
                  aria-label={`${day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${events.length} event${events.length === 1 ? '' : 's'}`}
                  className={`flex min-h-[64px] flex-col items-stretch gap-1 bg-surface p-1.5 text-left transition-colors hover:bg-surface-muted md:min-h-[92px] ${
                    inMonth ? '' : 'text-muted/60'
                  } ${selected ? 'ring-2 ring-inset ring-brand' : ''}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      key === todayKey ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {events.slice(0, 2).map((event) => (
                    <span key={event.id} className="hidden truncate rounded bg-lavender-surface px-1 py-0.5 text-[11px] md:block">
                      {event.title}
                    </span>
                  ))}
                  {events.length > 2 && <span className="hidden text-[11px] text-muted md:block">+{events.length - 2} more</span>}
                  {events.length > 0 && <span aria-hidden className="mt-auto h-1.5 w-1.5 rounded-full bg-lavender md:hidden" />}
                </button>
              );
            })}
          </div>
          {eventsQuery.isLoading && <Skeleton className="mt-4 h-10 w-full" />}
        </Card>

        <div className="space-y-6">
          <Card
            title={selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            description={dayEvents.length === 0 ? 'Nothing planned' : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
            action={
              <Button variant="lavender" aria-label="Add event on this day" onClick={() => setEditor({ event: null, day: selectedDay })}>
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            }
          >
            {dayEvents.length === 0 ? (
              <p className="text-sm text-muted">No events on this day.</p>
            ) : (
              <EventList events={dayEvents} onEdit={(event) => setEditor({ event, day: selectedDay })} onDelete={setPendingDelete} />
            )}
          </Card>

          <Card title="Upcoming" description="Your next events">
            {upcomingQuery.isLoading && <Skeleton className="h-16 w-full" />}
            {upcomingQuery.isError && <Alert>{errorMessage(upcomingQuery.error)}</Alert>}
            {upcomingQuery.data?.length === 0 && (
              <EmptyState icon={CalendarIcon} title="Nothing upcoming" description="Add an event and it will appear here." />
            )}
            {upcomingQuery.data && upcomingQuery.data.length > 0 && (
              <EventList events={upcomingQuery.data} showDate onEdit={(event) => setEditor({ event, day: new Date(event.starts_at) })} onDelete={setPendingDelete} />
            )}
          </Card>

          {notifyPermission !== 'unsupported' && (
            <Card title="Reminder alerts" description="Show a browser notification when a reminder is due, even when REVI is in the background.">
              {notifyPermission === 'granted' && (
                <p className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4" aria-hidden /> Browser alerts are on.</p>
              )}
              {notifyPermission === 'default' && (
                <Button variant="secondary" onClick={enableBrowserAlerts}><Bell className="h-4 w-4" aria-hidden /> Turn on browser alerts</Button>
              )}
              {notifyPermission === 'denied' && (
                <p className="flex items-start gap-2 text-sm text-muted"><BellOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Browser alerts are blocked. Allow notifications for this site in your browser settings to turn them on. Reminders still appear in your notifications.</p>
              )}
            </Card>
          )}
        </div>
      </div>

      {editor && (
        <EventEditor
          userId={userId}
          event={editor.event}
          defaultDay={editor.day}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this event?"
        description={`"${pendingDelete?.title ?? ''}" and its reminder will be removed.`}
        confirmLabel="Delete event"
        danger
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

