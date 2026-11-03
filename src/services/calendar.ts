import { supabase } from '../lib/supabase';
import type { CalendarEvent } from '../types/database';

export const EVENT_TITLE_MAX = 120;
export const EVENT_DESCRIPTION_MAX = 1000;

/** Reminder choices. Values are minutes before the start; '' means no reminder. */
export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'At start time' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

export interface EventInput {
  title: string;
  description: string;
  /** Local date-time as typed in a datetime-local input, e.g. 2026-11-03T14:30. */
  startsAtLocal: string;
  reminderMinutes: number | null;
}

export interface FiredReminder {
  id: string;
  title: string;
  startsAt: string;
}

export async function listEventsBetween(userId: string, fromIso: string, toIso: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('owner_id', userId)
    .gte('starts_at', fromIso)
    .lt('starts_at', toIso)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function listUpcomingEvents(userId: string, limit = 8): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('owner_id', userId)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

/** Converts the form's local date-time to an ISO timestamp and validates the fields. */
function toPayload(input: EventInput) {
  const title = input.title.trim();
  if (!title) throw new Error('Give the event a title.');
  if (title.length > EVENT_TITLE_MAX) throw new Error(`Titles can be up to ${EVENT_TITLE_MAX} characters.`);

  const description = input.description.trim();
  if (description.length > EVENT_DESCRIPTION_MAX) {
    throw new Error(`Descriptions can be up to ${EVENT_DESCRIPTION_MAX} characters.`);
  }

  const start = new Date(input.startsAtLocal);
  if (!input.startsAtLocal || Number.isNaN(start.getTime())) throw new Error('Pick a valid date and time.');

  return {
    title,
    description: description || null,
    starts_at: start.toISOString(),
    reminder_minutes: input.reminderMinutes,
  };
}

export async function createEvent(userId: string, input: EventInput): Promise<void> {
  const { error } = await supabase.from('calendar_events').insert({ owner_id: userId, ...toPayload(input) });
  if (error) throw translateError(error);
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { error } = await supabase.from('calendar_events').update(toPayload(input)).eq('id', id);
  if (error) throw translateError(error);
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Asks the server for reminders that are due now. Each one is marked sent and gets a
 * notification, so calling this repeatedly never repeats a reminder.
 */
export async function processReminders(): Promise<FiredReminder[]> {
  const { data, error } = await supabase.rpc('process_my_reminders');
  if (error) throw error;
  return ((data ?? []) as { reminder_event_id: string; reminder_title: string; reminder_starts_at: string }[]).map(
    (row) => ({ id: row.reminder_event_id, title: row.reminder_title, startsAt: row.reminder_starts_at }),
  );
}

function translateError(error: { code?: string; message: string }): Error {
  if (error.code === 'PGRST205' || /schema cache|could not find the table/i.test(error.message)) {
    return new Error("Calendar isn't set up in this Supabase project yet. Run supabase/migrations/007_messages_and_calendar.sql in the SQL Editor.");
  }
  return new Error(error.message);
}
