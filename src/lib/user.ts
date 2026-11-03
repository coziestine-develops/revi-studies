import type { User } from '@supabase/supabase-js';

export function displayName(user: User | null): string {
  const fullName: unknown = user?.user_metadata?.full_name;
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim();
  return user?.email?.split('@')[0] ?? 'there';
}

export function userInitials(user: User | null): string {
  const parts = displayName(user).split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]!.toUpperCase()).join('') || 'R';
}
