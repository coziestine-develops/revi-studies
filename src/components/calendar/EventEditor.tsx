import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell, Clock, Pencil, Trash2, X } from '../../icons';
import {
  createEvent,
  EVENT_DESCRIPTION_MAX,
  EVENT_TITLE_MAX,
  REMINDER_OPTIONS,
  updateEvent,
  type EventInput,
} from '../../services/calendar';
import { errorMessage, formatDateTime } from '../../lib/format';
import { startOfDay, toLocalInput } from '../../lib/calendarDates';
import type { CalendarEvent } from '../../types/database';
import { Button } from '../common/Button';
import { Alert, Field, inputClass, selectClass } from '../common/Forms';

export function reminderLabel(minutes: number | null): string {
  if (minutes === null) return 'No reminder';
  return REMINDER_OPTIONS.find((option) => option.value === String(minutes))?.label ?? `${minutes} minutes before`;
}

export function EventList({
  events,
  showDate = false,
  onEdit,
  onDelete,
}: {
  events: CalendarEvent[];
  showDate?: boolean;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {events.map((event) => (
        <li key={event.id} className="flex items-start gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{event.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                <time dateTime={event.starts_at}>{showDate ? formatDateTime(event.starts_at) : new Date(event.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
              </span>
              {event.reminder_minutes !== null && (
                <span className="inline-flex items-center gap-1">
                  <Bell className="h-3 w-3" aria-hidden /> {reminderLabel(event.reminder_minutes)}
                </span>
              )}
            </p>
            {event.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{event.description}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" aria-label={`Edit ${event.title}`} onClick={() => onEdit(event)} className="px-2">
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" aria-label={`Delete ${event.title}`} onClick={() => onDelete(event)} className="px-2 text-error hover:bg-error/10">
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EventEditor({
  userId,
  event,
  defaultDay,
  onClose,
  onSaved,
}: {
  userId: string;
  event: CalendarEvent | null;
  defaultDay: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialStart = event ? new Date(event.starts_at) : new Date(startOfDay(defaultDay).getTime() + 9 * 60 * 60 * 1000);
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(initialStart));
  const [reminder, setReminder] = useState(event ? (event.reminder_minutes === null ? '' : String(event.reminder_minutes)) : '15');
  const [formError, setFormError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (input: EventInput) => (event ? updateEvent(event.id, input) : createEvent(userId, input)),
    onSuccess: onSaved,
    onError: (err) => setFormError(errorMessage(err)),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    saveMutation.mutate({
      title,
      description,
      startsAtLocal: startsAt,
      reminderMinutes: reminder === '' ? null : Number(reminder),
    });
  }

  const titleId = 'event-editor-title';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-card border border-border bg-surface p-5 shadow-lg sm:rounded-card sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-base font-semibold tracking-tight">{event ? 'Edit event' : 'New event'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-control p-2 text-muted hover:bg-surface-muted">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {formError && <Alert>{formError}</Alert>}

          <Field id="event-title" label="Title">
            <input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={EVENT_TITLE_MAX}
              placeholder="e.g. Study group for Biology"
              className={inputClass}
              autoFocus
              required
            />
          </Field>

          <Field id="event-start" label="Date and time">
            <input id="event-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} required />
          </Field>

          <Field id="event-reminder" label="Reminder" hint="REVI checks for reminders while the app is open.">
            <select id="event-reminder" value={reminder} onChange={(e) => setReminder(e.target.value)} className={`${selectClass} w-full`}>
              {REMINDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>

          <Field id="event-description" label="Notes (optional)">
            <textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={EVENT_DESCRIPTION_MAX}
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saveMutation.isPending}>{event ? 'Save changes' : 'Add event'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
