import { supabase } from '../lib/supabase';
import type {
  FlashcardDeck, Flashcard, ProgressStatus, Quiz, QuizAttempt, QuizQuestion, StudyActivity, StudySession,
} from '../types/database';

export async function listDecks(): Promise<FlashcardDeck[]> {
  const { data, error } = await supabase.from('flashcard_decks').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FlashcardDeck[];
}

export async function getDeck(id: string): Promise<FlashcardDeck | null> {
  const { data, error } = await supabase.from('flashcard_decks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as FlashcardDeck | null) ?? null;
}

export async function createDeck(ownerId: string, title: string, description: string, reviewerId?: string | null): Promise<FlashcardDeck> {
  const { data, error } = await supabase
    .from('flashcard_decks')
    .insert({ owner_id: ownerId, title, description: description || null, reviewer_id: reviewerId ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data as FlashcardDeck;
}

export async function updateDeck(id: string, title: string, description: string): Promise<void> {
  const { error } = await supabase.from('flashcard_decks').update({ title, description: description || null }).eq('id', id);
  if (error) throw error;
}

export async function deleteDeck(id: string): Promise<void> {
  const { error } = await supabase.from('flashcard_decks').delete().eq('id', id);
  if (error) throw error;
}

export async function listCards(deckId: string): Promise<Flashcard[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('deck_id', deckId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Flashcard[];
}

export async function createCard(deckId: string, position: number, front: string, back: string): Promise<void> {
  const { error } = await supabase.from('flashcards').insert({ deck_id: deckId, position, front, back });
  if (error) throw error;
}

export async function updateCard(id: string, front: string, back: string): Promise<void> {
  const { error } = await supabase.from('flashcards').update({ front, back }).eq('id', id);
  if (error) throw error;
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from('flashcards').delete().eq('id', id);
  if (error) throw error;
}

export async function listProgress(userId: string, cardIds: string[]): Promise<Record<string, ProgressStatus>> {
  if (cardIds.length === 0) return {};
  const { data, error } = await supabase
    .from('flashcard_progress')
    .select('flashcard_id, status')
    .eq('user_id', userId)
    .in('flashcard_id', cardIds);
  if (error) throw error;
  const map: Record<string, ProgressStatus> = {};
  for (const row of (data ?? []) as { flashcard_id: string; status: ProgressStatus }[]) {
    map[row.flashcard_id] = row.status;
  }
  return map;
}

export async function setProgress(userId: string, cardId: string, status: ProgressStatus): Promise<void> {
  const { error } = await supabase
    .from('flashcard_progress')
    .upsert({ user_id: userId, flashcard_id: cardId, status, updated_at: new Date().toISOString() }, { onConflict: 'user_id,flashcard_id' });
  if (error) throw error;
}

export async function startSession(userId: string, reviewerId: string | null, activity: StudyActivity): Promise<string> {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({ user_id: userId, reviewer_id: reviewerId, activity })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Records a finished focus block in one insert, so paused time never inflates the duration. */
export async function logSession(userId: string, activity: StudyActivity, startedAt: Date, seconds: number): Promise<void> {
  const { error } = await supabase.from('study_sessions').insert({
    user_id: userId,
    reviewer_id: null,
    activity,
    started_at: startedAt.toISOString(),
    ended_at: new Date(startedAt.getTime() + seconds * 1000).toISOString(),
    duration_seconds: Math.max(0, Math.round(seconds)),
  });
  if (error) throw error;
}

export async function endSession(id: string, startedAt: string): Promise<void> {
  const endedAt = new Date();
  const seconds = Math.max(0, Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 1000));
  const { error } = await supabase
    .from('study_sessions')
    .update({ ended_at: endedAt.toISOString(), duration_seconds: seconds })
    .eq('id', id);
  if (error) throw error;
}

export async function listSessions(userId: string): Promise<StudySession[]> {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as StudySession[];
}

export async function listQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Quiz[];
}

/** Questions never include answer keys; those are only returned by the grading function. */
export async function listQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id, quiz_id, position, question_type, prompt, options')
    .eq('quiz_id', quizId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as QuizQuestion[];
}

export async function startAttempt(userId: string, quizId: string): Promise<string> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert({ user_id: userId, quiz_id: quizId })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listAttempts(userId: string): Promise<QuizAttempt[]> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('user_id', userId)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as QuizAttempt[];
}

/** Deletes one of your study sessions. Row Level Security skips rows you don't own, so check that a row was removed. */
export async function deleteSession(id: string): Promise<void> {
  const { data, error } = await supabase.from('study_sessions').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("This session couldn't be deleted. It may already be gone.");
}

/** Deletes one of your quiz attempts. Row Level Security silently skips rows you don't own, so check that a row was removed. */
export async function deleteAttempt(id: string): Promise<void> {
  const { data, error } = await supabase.from('quiz_attempts').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("This attempt couldn't be deleted. It may already be gone.");
}
