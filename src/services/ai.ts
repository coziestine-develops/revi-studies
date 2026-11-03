import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/functions';
import type { AIGeneration, AIKind } from '../types/database';

export interface GenerationResponse {
  generationId: string;
  kind: AIKind;
  result: unknown;
  deckId?: string;
  quizId?: string;
}

export const AI_KIND_OPTIONS: { value: AIKind; label: string; hint: string }[] = [
  { value: 'summary', label: 'Summary', hint: 'A short overview of the material' },
  { value: 'key_concepts', label: 'Key concepts', hint: 'Important terms and definitions' },
  { value: 'flashcards', label: 'Flashcards', hint: 'Saved as a new deck you can study' },
  { value: 'quiz', label: 'Quiz', hint: 'Multiple-choice and true-or-false questions' },
  { value: 'explanation', label: 'Explain', hint: 'A plain-language explanation of the topic' },
];

export function generateStudyContent(reviewerId: string, kind: AIKind): Promise<GenerationResponse> {
  return invokeFunction<GenerationResponse>('generate-study-content', { reviewerId, kind });
}

export async function listGenerations(userId: string): Promise<AIGeneration[]> {
  const { data, error } = await supabase
    .from('ai_generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as AIGeneration[];
}

