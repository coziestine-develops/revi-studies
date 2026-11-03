import { useRef, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Trash2 } from '../../icons';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/format';
import { UserAvatar } from '../common/UserAvatar';
import { Button } from '../common/Button';
import { Alert } from '../common/Forms';

export const AVATAR_BUCKET = 'avatars';
const MAX_BYTES = 2 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const AVATAR_SIZE = 512;

/** Built-in REVI avatars. Files live in public/avatars. Choosing one stores its path in profiles.avatar_url. */
export const AVATAR_PRESETS = [
  { id: 'avatar-1', label: 'REVI with a pencil', src: '/avatars/avatar-1.png' },
  { id: 'avatar-2', label: 'REVI listening to music', src: '/avatars/avatar-2.png' },
  { id: 'avatar-3', label: 'REVI with books', src: '/avatars/avatar-3.png' },
  { id: 'avatar-4', label: 'REVI studying on a laptop', src: '/avatars/avatar-4.png' },
  { id: 'avatar-5', label: 'REVI with a notebook', src: '/avatars/avatar-5.png' },
] as const;

/** Crops the photo to a centered square so it always sits in the middle of the round avatar. */
async function cropToSquare(file: File): Promise<{ blob: Blob; type: string; extension: string }> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process this image.');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error('Could not process this image.');
  return { blob, type, extension: type === 'image/png' ? 'png' : 'jpg' };
}

/** Deletes the previous uploaded photo from storage. Preset avatars are not in storage, so they are skipped. Failures are ignored. */
async function removeStoredPhoto(url: string | null | undefined) {
  if (!url) return;
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(url.slice(index + marker.length));
  await supabase.storage.from(AVATAR_BUCKET).remove([path]).catch(() => undefined);
}

interface AvatarUploaderProps {
  userId: string;
  name: string;
  url?: string | null;
}

export function AvatarUploader({ userId, name, url }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function saveAvatarUrl(nextUrl: string | null) {
    const { error } = await supabase.from('profiles').update({ avatar_url: nextUrl }).eq('id', userId);
    if (error) throw error;
  }

  async function choosePreset(src: string) {
    if (src === url) return;
    setBusy(true);
    setMessage(null);
    try {
      await saveAvatarUrl(src);
      await removeStoredPhoto(url);
      await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      setMessage({ tone: 'success', text: 'Avatar updated.' });
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const extension = EXTENSIONS[file.type];
    if (!extension) {
      setMessage({ tone: 'error', text: 'Use a PNG, JPG, or WEBP image.' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ tone: 'error', text: 'Choose an image under 2 MB.' });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const cropped = await cropToSquare(file);
      const path = `${userId}/avatar-${Date.now()}.${cropped.extension}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, cropped.blob, { contentType: cropped.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      try {
        await saveAvatarUrl(data.publicUrl);
      } catch (updateError) {
        await supabase.storage.from(AVATAR_BUCKET).remove([path]);
        throw updateError;
      }

      await removeStoredPhoto(url);
      await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      setMessage({ tone: 'success', text: 'Profile photo updated.' });
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    setMessage(null);
    try {
      await saveAvatarUrl(null);
      await removeStoredPhoto(url);
      await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      setMessage({ tone: 'success', text: 'Avatar removed. The REVI mascot is shown instead.' });
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const isPreset = AVATAR_PRESETS.some((preset) => preset.src === url);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <UserAvatar url={url} name={name} size="h-20 w-20" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold">Profile photo</p>
            <p className="text-xs text-muted">Choose a REVI avatar below or upload your own. PNG, JPG, or WEBP, up to 2 MB.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPick}
              className="sr-only"
              aria-label="Choose a profile photo"
              disabled={busy}
            />
            <Button variant="secondary" onClick={() => inputRef.current?.click()} loading={busy}>
              <Camera className="h-4 w-4" aria-hidden /> {url && !isPreset ? 'Change photo' : 'Upload photo'}
            </Button>
            {url && (
              <Button variant="danger-outline" onClick={removePhoto} disabled={busy}>
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">REVI avatars</p>
        <div role="radiogroup" aria-label="REVI avatars" className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {AVATAR_PRESETS.map((preset) => {
            const selected = url === preset.src;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={preset.label}
                disabled={busy}
                onClick={() => choosePreset(preset.src)}
                className={`group relative aspect-square w-full overflow-hidden rounded-full bg-lavender-surface p-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--revi-lavender))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? 'ring-4 ring-[rgb(var(--revi-lavender))]'
                    : 'ring-2 ring-transparent hover:ring-border'
                }`}
              >
                <img src={preset.src} alt="" aria-hidden className="h-full w-full rounded-full object-cover object-center" />
                {selected && (
                  <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--revi-lavender))] text-on-accent ring-2 ring-surface">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {message && <Alert tone={message.tone === 'error' ? 'error' : 'success'}>{message.text}</Alert>}
    </div>
  );
}
