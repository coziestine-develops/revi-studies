import { supabase } from '../lib/supabase';
import { parseTags, type ReviewerFormValues } from '../schemas/forms';
import type { Profile, Reviewer, ReviewerFile, ReviewerShare, SharePermission } from '../types/database';

export const REVIEWER_BUCKET = 'revi-reviewers';
/** Largest file a reviewer can hold. Keep in sync with reviewer_files and the revi-reviewers bucket (migration 006). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_MB = MAX_FILE_BYTES / (1024 * 1024);

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
};

export const ACCEPT_ATTRIBUTE = Object.keys(MIME_BY_EXTENSION).join(',');
const ALLOWED_MIME = new Set(Object.values(MIME_BY_EXTENSION));

export function resolveMime(file: File): string | null {
  if (ALLOWED_MIME.has(file.type)) return file.type;
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? null;
}

export function validateFile(file: File): string | null {
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_FILE_BYTES) return `The file is larger than ${MAX_FILE_MB} MB.`;
  if (!resolveMime(file)) return 'Unsupported type. Use PDF, DOCX, PPTX, PNG, JPG, WEBP, or TXT.';
  return null;
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

export async function listReviewers(): Promise<Reviewer[]> {
  const { data, error } = await supabase.from('reviewers').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Reviewer[];
}

export async function getReviewer(id: string): Promise<Reviewer | null> {
  const { data, error } = await supabase.from('reviewers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Reviewer | null) ?? null;
}

export async function listAllReviewerFiles(): Promise<Pick<ReviewerFile, 'reviewer_id' | 'mime_type'>[]> {
  const { data, error } = await supabase.from('reviewer_files').select('reviewer_id, mime_type');
  if (error) throw error;
  return (data ?? []) as Pick<ReviewerFile, 'reviewer_id' | 'mime_type'>[];
}

export async function listFiles(reviewerId: string): Promise<ReviewerFile[]> {
  const { data, error } = await supabase
    .from('reviewer_files')
    .select('*')
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReviewerFile[];
}

/** RFC 4122 v4 UUID. Uses getRandomValues so it also works on http pages where randomUUID is unavailable. */
function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Creates a reviewer. The id is generated here and the insert doesn't ask for the row back:
 * returning rows makes Postgres also run the select policy on the new row, which can fail
 * right after an insert. The owner still has to pass the insert policy (owner_id = auth.uid()).
 */
export async function createReviewer(values: ReviewerFormValues, ownerId: string): Promise<Reviewer> {
  const id = newId();
  const tags = parseTags(values.tags);
  const subject = values.subject || null;
  const description = values.description || null;

  const { error } = await supabase.from('reviewers').insert({
    id,
    owner_id: ownerId,
    title: values.title,
    subject,
    description,
    tags,
    visibility: values.visibility,
  });
  if (error) throw error;

  const now = new Date().toISOString();
  return {
    id,
    owner_id: ownerId,
    title: values.title,
    subject,
    description,
    tags,
    visibility: values.visibility,
    created_at: now,
    updated_at: now,
  };
}

export async function updateReviewer(id: string, values: ReviewerFormValues): Promise<void> {
  const { error } = await supabase
    .from('reviewers')
    .update({
      title: values.title,
      subject: values.subject || null,
      description: values.description || null,
      tags: parseTags(values.tags),
      visibility: values.visibility,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function updateVisibility(id: string, visibility: Reviewer['visibility']): Promise<void> {
  const { error } = await supabase.from('reviewers').update({ visibility }).eq('id', id);
  if (error) throw error;
}

export async function deleteReviewer(id: string): Promise<void> {
  const files = await listFiles(id);
  if (files.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(REVIEWER_BUCKET)
      .remove(files.map((file) => file.storage_path));
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from('reviewers').delete().eq('id', id);
  if (error) throw error;
}

/** Uploads one file to private storage and records its metadata. Cleans up the object if the row fails. */
export async function uploadReviewerFile(reviewerId: string, uploaderId: string, file: File): Promise<ReviewerFile> {
  const problem = validateFile(file);
  if (problem) throw new Error(`${file.name}: ${problem}`);
  const mime = resolveMime(file)!;

  const path = `${reviewerId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(REVIEWER_BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);

  const { data, error } = await supabase
    .from('reviewer_files')
    .insert({
      reviewer_id: reviewerId,
      uploaded_by: uploaderId,
      storage_path: path,
      file_name: file.name.slice(0, 255),
      mime_type: mime,
      size_bytes: file.size,
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(REVIEWER_BUCKET).remove([path]);
    throw new Error(`${file.name}: ${error.message}`);
  }
  return data as ReviewerFile;
}

/**
 * Permanently deletes a file: its database row first, then the stored object.
 * Row-level security can block a delete without returning an error, so each step checks
 * that something was actually removed. If the row is blocked, nothing else is touched.
 */
export async function deleteReviewerFile(file: ReviewerFile): Promise<void> {
  const { data: removedRows, error } = await supabase
    .from('reviewer_files')
    .delete()
    .eq('id', file.id)
    .select('id');
  if (error) throw error;
  if (!removedRows || removedRows.length === 0) {
    throw new Error('This file could not be deleted. You may not have permission to edit this reviewer.');
  }

  const { error: storageError } = await supabase.storage.from(REVIEWER_BUCKET).remove([file.storage_path]);
  if (storageError) throw new Error(`The file was removed, but its stored copy could not be cleaned up: ${storageError.message}`);
}

/** Short-lived signed URL for an authorized file. Private files are never exposed publicly. */
export async function getFileUrl(file: ReviewerFile): Promise<string> {
  const { data, error } = await supabase.storage.from(REVIEWER_BUCKET).createSignedUrl(file.storage_path, 300);
  if (error || !data) throw error ?? new Error('Could not open this file.');
  return data.signedUrl;
}

/**
 * The stored file as a Blob, downloaded with the signed-in session. Viewers read it from
 * memory, so they work on phones and desktops alike without signed-URL iframes.
 */
export async function downloadFileBlob(file: ReviewerFile): Promise<Blob> {
  const { data, error } = await supabase.storage.from(REVIEWER_BUCKET).download(file.storage_path);
  if (error || !data) throw error ?? new Error('Could not open this file.');
  return data;
}

/**
 * Saves a file to the device. A blob link is used instead of window.open, because phone
 * browsers block pop-ups that open after an await.
 */
export async function saveFileToDevice(file: ReviewerFile): Promise<void> {
  const blob = await downloadFileBlob(file);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.file_name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadFileText(file: ReviewerFile): Promise<string> {
  const { data, error } = await supabase.storage.from(REVIEWER_BUCKET).download(file.storage_path);
  if (error || !data) throw error ?? new Error('Could not read this file.');
  return data.text();
}

export async function listSavedIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('saved_reviewers').select('reviewer_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row: { reviewer_id: string }) => row.reviewer_id);
}

export async function listSharedWithMeIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('reviewer_shares').select('reviewer_id').eq('shared_with', userId);
  if (error) throw error;
  return (data ?? []).map((row: { reviewer_id: string }) => row.reviewer_id);
}

export async function setSaved(userId: string, reviewerId: string, saved: boolean): Promise<void> {
  if (saved) {
    const { error } = await supabase.from('saved_reviewers').upsert({ user_id: userId, reviewer_id: reviewerId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('saved_reviewers').delete().eq('user_id', userId).eq('reviewer_id', reviewerId);
    if (error) throw error;
  }
}

export async function listShares(reviewerId: string): Promise<ReviewerShare[]> {
  const { data, error } = await supabase.from('reviewer_shares').select('*').eq('reviewer_id', reviewerId);
  if (error) throw error;
  return (data ?? []) as ReviewerShare[];
}

export async function getMyShare(reviewerId: string, userId: string): Promise<ReviewerShare | null> {
  const { data, error } = await supabase
    .from('reviewer_shares')
    .select('*')
    .eq('reviewer_id', reviewerId)
    .eq('shared_with', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ReviewerShare | null) ?? null;
}

export async function upsertShare(reviewerId: string, profileId: string, permission: SharePermission): Promise<void> {
  const { error } = await supabase
    .from('reviewer_shares')
    .upsert(
      { reviewer_id: reviewerId, shared_with: profileId, permission },
      { onConflict: 'reviewer_id,shared_with' },
    );
  if (error) throw error;
}

export async function removeShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('reviewer_shares').delete().eq('id', shareId);
  if (error) throw error;
}

export async function findProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, school, course, avatar_url')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function getProfiles(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, school, course, avatar_url')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as Profile[];
}