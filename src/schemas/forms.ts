import { z } from 'zod';

export const visibilityValues = ['private', 'friends', 'shared', 'public'] as const;

export const reviewerFormSchema = z.object({
  title: z.string().trim().min(1, 'Give your reviewer a title.').max(200, 'Keep the title under 200 characters.'),
  subject: z.string().trim().max(100, 'Keep the subject under 100 characters.'),
  description: z.string().trim().max(2000, 'Keep the description under 2000 characters.'),
  tags: z.string().max(300, 'Keep tags under 300 characters.'),
  visibility: z.enum(visibilityValues),
});
export type ReviewerFormValues = z.infer<typeof reviewerFormSchema>;

export function parseTags(raw: string): string[] {
  const tags = raw
    .split(',')
    .map((tag) => tag.trim().toLowerCase().slice(0, 30))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 10);
}

export const deckFormSchema = z.object({
  title: z.string().trim().min(1, 'Enter a deck title.').max(200, 'Keep the title under 200 characters.'),
  description: z.string().trim().max(1000, 'Keep the description under 1000 characters.'),
});
export type DeckFormValues = z.infer<typeof deckFormSchema>;

export const cardFormSchema = z.object({
  front: z.string().trim().min(1, 'Enter the front of the card.').max(2000, 'Keep the front under 2000 characters.'),
  back: z.string().trim().min(1, 'Enter the back of the card.').max(2000, 'Keep the back under 2000 characters.'),
});
export type CardFormValues = z.infer<typeof cardFormSchema>;

export const nameFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(100, 'Keep the name under 100 characters.'),
});
export type NameFormValues = z.infer<typeof nameFormSchema>;

export const profileFormSchema = z.object({
  full_name: z.string().trim().max(100, 'Keep your name under 100 characters.'),
  username: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[a-z0-9_]{3,30}$/.test(value), 'Use 3–30 lowercase letters, numbers, or underscores.'),
  school: z.string().trim().max(150, 'Keep the school name under 150 characters.'),
  course: z.string().trim().max(150, 'Keep the course under 150 characters.'),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const usernameSearchSchema = z.object({
  username: z.string().trim().toLowerCase().refine((value) => /^[a-z0-9_]{3,30}$/.test(value), 'Enter a valid username (3–30 letters, numbers, or underscores).'),
});
export type UsernameFormValues = z.infer<typeof usernameSearchSchema>;
