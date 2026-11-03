import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Monitor, Moon, Sun } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { deleteAccount, getMyProfile, updateMyProfile } from '../services/social';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/format';
import { friendlyAuthError } from '../lib/authErrors';
import { profileFormSchema, type ProfileFormValues } from '../schemas/forms';
import { Card } from '../components/common/Card';
import { Alert, Field, PasswordInput, inputClass } from '../components/common/Forms';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Skeleton } from '../components/common/Skeleton';
import { AvatarUploader } from '../components/profile/AvatarUploader';
import { z } from 'zod';

const passwordSchema = z
  .object({ password: z.string().min(6, 'Use at least 6 characters.'), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match.', path: ['confirm'] });

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [profileMsg, setProfileMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const profileQuery = useQuery({ queryKey: ['my-profile', userId], queryFn: () => getMyProfile(userId), enabled: !!userId });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { full_name: '', username: '', school: '', course: '' },
  });

  useEffect(() => {
    const p = profileQuery.data;
    if (p) {
      profileForm.reset({
        full_name: p.full_name ?? '',
        username: p.username ?? '',
        school: p.school ?? '',
        course: p.course ?? '',
      });
    }
  }, [profileQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const passwordForm = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  async function saveProfile(values: ProfileFormValues) {
    setProfileMsg(null);
    try {
      await updateMyProfile(userId, values);
      queryClient.invalidateQueries({ queryKey: ['my-profile', userId] });
      setProfileMsg({ tone: 'success', text: 'Profile saved.' });
    } catch (err) {
      setProfileMsg({ tone: 'error', text: errorMessage(err) });
    }
  }

  async function changePassword(values: { password: string }) {
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) setPasswordMsg({ tone: 'error', text: friendlyAuthError(error) });
    else {
      passwordForm.reset({ password: '', confirm: '' });
      setPasswordMsg({ tone: 'success', text: 'Password updated.' });
    }
  }

  async function sendReset() {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` });
    setResetMsg(error ? friendlyAuthError(error) : 'We sent a reset link to your email.');
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your profile, appearance, and account.</p>
      </header>

      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Profile" description="Shown to friends when you share or connect.">
            <AvatarUploader userId={userId} name={profileQuery.data?.full_name || user?.email || 'Profile'} url={profileQuery.data?.avatar_url} />
            <div className="my-5 h-px bg-border" />
            {profileQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
              <form onSubmit={profileForm.handleSubmit(saveProfile)} noValidate className="grid gap-5 md:grid-cols-2">
                <Field id="full_name" label="Full name" error={profileForm.formState.errors.full_name?.message}>
                  <input id="full_name" className={inputClass} aria-invalid={!!profileForm.formState.errors.full_name} {...profileForm.register('full_name')} />
                </Field>
                <Field id="username" label="Username" hint="Lowercase letters, numbers, underscores. Friends find you by this." error={profileForm.formState.errors.username?.message}>
                  <input id="username" className={inputClass} aria-invalid={!!profileForm.formState.errors.username} {...profileForm.register('username')} />
                </Field>
                <Field id="school" label="School" error={profileForm.formState.errors.school?.message}>
                  <input id="school" className={inputClass} aria-invalid={!!profileForm.formState.errors.school} {...profileForm.register('school')} />
                </Field>
                <Field id="course" label="Course" error={profileForm.formState.errors.course?.message}>
                  <input id="course" className={inputClass} aria-invalid={!!profileForm.formState.errors.course} {...profileForm.register('course')} />
                </Field>
                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                  {profileMsg ? <Alert tone={profileMsg.tone === 'error' ? 'error' : 'success'}>{profileMsg.text}</Alert> : <span />}
                  <Button type="submit" loading={profileForm.formState.isSubmitting}>Save profile</Button>
                </div>
              </form>
            )}
          </Card>

          <Card title="Account" description={user?.email ?? ''}>
            <form onSubmit={passwordForm.handleSubmit(changePassword)} noValidate className="grid gap-5 md:grid-cols-2">
              <Field id="new-password" label="New password" error={passwordForm.formState.errors.password?.message}>
                <PasswordInput id="new-password" autoComplete="new-password" className={inputClass} aria-invalid={!!passwordForm.formState.errors.password} {...passwordForm.register('password')} />
              </Field>
              <Field id="confirm-password" label="Confirm password" error={passwordForm.formState.errors.confirm?.message}>
                <PasswordInput id="confirm-password" autoComplete="new-password" className={inputClass} aria-invalid={!!passwordForm.formState.errors.confirm} {...passwordForm.register('confirm')} />
              </Field>
              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                {passwordMsg ? <Alert tone={passwordMsg.tone === 'error' ? 'error' : 'success'}>{passwordMsg.text}</Alert> : <span />}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={sendReset}>Email me a reset link</Button>
                  <Button type="submit" loading={passwordForm.formState.isSubmitting}>Update password</Button>
                </div>
              </div>
              {resetMsg && <p role="status" className="md:col-span-2 text-sm text-muted">{resetMsg}</p>}
            </form>
          </Card>

          <Card title="Danger zone" description="Deleting your account removes your reviewers, files, decks, and history. This can't be undone.">
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete my account</Button>
          </Card>
        </div>

      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete your account?"
        description="Everything you've created will be permanently removed. Type DELETE to confirm."
        confirmLabel="Delete account"
        danger
        loading={deleting}
        confirmDisabled={deleteWord !== 'DELETE'}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteOpen(false); setDeleteWord(''); setDeleteError(null); }}
      >
        <input
          aria-label="Type DELETE to confirm"
          value={deleteWord}
          onChange={(e) => setDeleteWord(e.target.value)}
          className={inputClass}
          placeholder="DELETE"
        />
        {deleteError && <p role="alert" className="mt-2 text-sm text-error">{deleteError}</p>}
      </ConfirmDialog>
    </div>
  );
}
