import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, Download, Eye, FileText, Pencil, Play, Square, Trash2, UserPlus, Users, X } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { useToast } from '../components/common/Toast';
import {
  deleteReviewer, deleteReviewerFile, findProfileByUsername, getMyShare, getProfiles, getReviewer,
  listFiles, listSavedIds, listShares, removeShare, saveFileToDevice, setSaved, updateReviewer, updateVisibility,
  uploadReviewerFile, upsertShare, validateFile,
} from '../services/reviewers';
import { viewerKindOf } from '../lib/fileViewer';
import { endSession, startSession } from '../services/study';
import { errorMessage, formatBytes, formatDate } from '../lib/format';
import { usernameSearchSchema, visibilityValues, type ReviewerFormValues } from '../schemas/forms';
import { ReviewerForm, VISIBILITY_OPTIONS } from '../components/reviewers/ReviewerForm';
import { VisibilityPill } from '../components/reviewers/ReviewerCard';
import { CameraCaptureDialog } from '../components/reviewers/CameraCaptureDialog';
import { FileViewer } from '../components/reviewers/FileViewer';
import { Card } from '../components/common/Card';
import { Alert, Field, inputClass } from '../components/common/Forms';
import { Button, buttonClasses } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Skeleton } from '../components/common/Skeleton';
import { RevLoader } from '../components/common/RevLoader';
import type { ReviewerFile, SharePermission, Visibility } from '../types/database';

type Notice = { tone: 'error' | 'success'; text: string } | null;

/** Files the in-app viewer can show. Other types get a download button only. */
function canPreview(mime: string): boolean {
  return viewerKindOf(mime) !== null;
}

export default function ReviewerDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const userId = user?.id ?? '';

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fileToRemove, setFileToRemove] = useState<ReviewerFile | null>(null);
  const [removingFile, setRemovingFile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const [savePending, setSavePending] = useState(false);
  const [shareName, setShareName] = useState('');
  const [sharePermission, setSharePermission] = useState<SharePermission>('viewer');
  const [shareBusy, setShareBusy] = useState(false);
  const [studySession, setStudySession] = useState<{ id: string; startedAt: string } | null>(null);
  const [viewing, setViewing] = useState<ReviewerFile | null>(null);

  const reviewerQuery = useQuery({ queryKey: ['reviewer', id], queryFn: () => getReviewer(id), enabled: !!id });
  const reviewer = reviewerQuery.data ?? null;
  const isOwner = !!reviewer && reviewer.owner_id === userId;

  const filesQuery = useQuery({ queryKey: ['reviewer-files', id], queryFn: () => listFiles(id), enabled: !!reviewer });
  const savedQuery = useQuery({ queryKey: ['saved', userId], queryFn: () => listSavedIds(userId), enabled: !!userId });
  const myShareQuery = useQuery({
    queryKey: ['my-share', id, userId],
    queryFn: () => getMyShare(id, userId),
    enabled: !!reviewer && !isOwner && !!userId,
  });
  const sharesQuery = useQuery({ queryKey: ['shares', id], queryFn: () => listShares(id), enabled: isOwner });
  const shareProfilesQuery = useQuery({
    queryKey: ['share-profiles', id, (sharesQuery.data ?? []).map((s) => s.shared_with).join(',')],
    queryFn: () => getProfiles((sharesQuery.data ?? []).map((s) => s.shared_with)),
    enabled: isOwner && (sharesQuery.data ?? []).length > 0,
  });
  const ownerQuery = useQuery({
    queryKey: ['profile', reviewer?.owner_id],
    queryFn: () => getProfiles([reviewer!.owner_id]),
    enabled: !!reviewer && !isOwner,
  });

  const files = filesQuery.data ?? [];
  const shares = sharesQuery.data ?? [];
  const isSaved = (savedQuery.data ?? []).includes(id);
  const canEdit = isOwner || myShareQuery.data?.permission === 'editor';
  const ownerName = ownerQuery.data?.[0]?.full_name || ownerQuery.data?.[0]?.username || 'a classmate';
  const shareNameById = new Map((shareProfilesQuery.data ?? []).map((p) => [p.id, p.username || p.full_name || 'Unnamed user']));

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ['reviewer', id] });
    queryClient.invalidateQueries({ queryKey: ['reviewer-files', id] });
    queryClient.invalidateQueries({ queryKey: ['reviewers'] });
    queryClient.invalidateQueries({ queryKey: ['all-reviewer-files'] });
    queryClient.invalidateQueries({ queryKey: ['shares', id] });
  }

  async function toggleSave() {
    setSavePending(true);
    try {
      await setSaved(userId, id, !isSaved);
      queryClient.invalidateQueries({ queryKey: ['saved', userId] });
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSavePending(false);
    }
  }

  async function handleEdit(values: ReviewerFormValues, newFiles: File[]) {
    setSaving(true);
    setFormError(null);
    try {
      await updateReviewer(id, values);
      for (const file of newFiles) await uploadReviewerFile(id, userId, file);
      refreshAll();
      setEditing(false);
      setNotice({ tone: 'success', text: 'Reviewer updated.' });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteReviewer(id);
      queryClient.invalidateQueries({ queryKey: ['reviewers'] });
      queryClient.invalidateQueries({ queryKey: ['all-reviewer-files'] });
      toast('Reviewer deleted.');
      navigate('/library', { replace: true });
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleUploadMore(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    await uploadPickedFiles(picked);
  }

  async function uploadPickedFiles(picked: File[]) {
    if (picked.length === 0) return;
    setUploading(true);
    const failures: string[] = [];
    for (const file of picked) {
      const problem = validateFile(file);
      if (problem) {
        failures.push(`${file.name}: ${problem}`);
        continue;
      }
      try {
        await uploadReviewerFile(id, userId, file);
      } catch (err) {
        failures.push(errorMessage(err));
      }
    }
    refreshAll();
    setUploading(false);
    setNotice(failures.length ? { tone: 'error', text: failures.join(' ') } : { tone: 'success', text: 'Files added.' });
  }

  async function handleRemoveFile() {
    const file = fileToRemove;
    if (!file) return;
    setRemovingFile(true);
    try {
      await deleteReviewerFile(file);
      refreshAll();
      if (viewing?.id === file.id) setViewing(null);
      setNotice({ tone: 'success', text: `${file.file_name} was permanently deleted.` });
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    } finally {
      setRemovingFile(false);
      setFileToRemove(null);
    }
  }

  function openViewer(file: ReviewerFile) {
    setViewing(file);
  }

  async function downloadFile(file: ReviewerFile) {
    try {
      await saveFileToDevice(file);
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    }
  }

  async function handleAddShare() {
    const parsed = usernameSearchSchema.safeParse({ username: shareName });
    if (!parsed.success) {
      setNotice({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Enter a username.' });
      return;
    }
    setShareBusy(true);
    try {
      const profile = await findProfileByUsername(parsed.data.username);
      if (!profile) throw new Error('No user has that username.');
      if (profile.id === userId) throw new Error('You already own this reviewer.');
      await upsertShare(id, profile.id, sharePermission);
      setShareName('');
      refreshAll();
      setNotice({ tone: 'success', text: `Shared with @${profile.username}.` });
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    } finally {
      setShareBusy(false);
    }
  }

  async function handleRevoke(shareId: string) {
    try {
      await removeShare(shareId);
      refreshAll();
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    }
  }

  async function handleVisibility(value: Visibility) {
    try {
      await updateVisibility(id, value);
      refreshAll();
      setNotice({ tone: 'success', text: 'Visibility updated.' });
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    }
  }

  async function toggleStudy() {
    try {
      if (studySession) {
        await endSession(studySession.id, studySession.startedAt);
        setStudySession(null);
        queryClient.invalidateQueries({ queryKey: ['sessions'] });
        setNotice({ tone: 'success', text: 'Study session saved.' });
      } else {
        const startedAt = new Date().toISOString();
        const sessionId = await startSession(userId, id, 'reviewing');
        setStudySession({ id: sessionId, startedAt });
      }
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    }
  }

  const closeViewer = useCallback(() => setViewing(null), []);

  if (reviewerQuery.isLoading) {
    return <RevLoader label="Opening reviewer" />;
  }

  if (reviewerQuery.isError) {
    return <Alert>Couldn't load this reviewer: {errorMessage(reviewerQuery.error)}</Alert>;
  }

  if (!reviewer) {
    return (
      <Card>
        <h1 className="text-lg font-semibold">Reviewer not found</h1>
        <p className="mt-1 text-sm text-muted">It may have been deleted, or you don't have access to it.</p>
        <Link to="/library" className={`${buttonClasses('secondary')} mt-4`}>Back to library</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'My Reviewers', to: '/library' }, { label: reviewer.title }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{reviewer.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {reviewer.subject && <span className="rounded-full bg-lavender-surface px-2.5 py-0.5 text-xs font-medium">{reviewer.subject}</span>}
            <VisibilityPill value={reviewer.visibility} />
            {reviewer.tags.map((tag) => <span key={tag} className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-muted">#{tag}</span>)}
          </div>
          <p className="mt-2 text-sm text-muted">
            {isOwner ? 'Owned by you' : `Shared by ${ownerName}`} · Updated {formatDate(reviewer.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isOwner && (
            <Button variant={isSaved ? 'mint' : 'secondary'} onClick={toggleSave} loading={savePending} aria-pressed={isSaved}>
              {isSaved ? 'Saved' : 'Save to library'}
            </Button>
          )}
          {canEdit && !editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden /> Edit</Button>
          )}
          {isOwner && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" aria-hidden /> Delete</Button>
          )}
        </div>
      </header>

      {notice && (
        <Alert tone={notice.tone === 'error' ? 'error' : 'success'}>{notice.text}</Alert>
      )}

      {editing && (
        <Card title="Edit reviewer" description="Changes apply to everyone who can view this reviewer.">
          <ReviewerForm
            defaultValues={{
              title: reviewer.title,
              subject: reviewer.subject ?? '',
              description: reviewer.description ?? '',
              tags: reviewer.tags.join(', '),
              visibility: reviewer.visibility,
            }}
            submitLabel="Save changes"
            loading={saving}
            allowFiles
            error={formError}
            onSubmit={handleEdit}
            onCancel={() => { setEditing(false); setFormError(null); }}
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Files"
            description={`${files.length} ${files.length === 1 ? 'file' : 'files'}`}
            action={canEdit ? (
              <div className="flex flex-wrap gap-2">
                <label className={`${buttonClasses('secondary')} cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
                  {uploading ? 'Uploading…' : 'Add files'}
                  <input type="file" multiple className="sr-only" onChange={handleUploadMore} disabled={uploading} accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp,.txt" />
                </label>
                <Button variant="secondary" onClick={() => setCameraOpen(true)} disabled={uploading}>
                  <Camera className="h-4 w-4" aria-hidden /> Take photo
                </Button>
              </div>
            ) : undefined}
          >
            {filesQuery.isLoading && <Skeleton className="h-16 w-full" />}
            {filesQuery.isError && <Alert>Couldn't load files: {errorMessage(filesQuery.error)}</Alert>}
            {!filesQuery.isLoading && files.length === 0 && (
              <p className="rounded-control border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted">
                No files yet.{canEdit ? ' Add study materials to this reviewer.' : ''}
              </p>
            )}
            <ul className="divide-y divide-border">
              {files.map((file) => {
                const viewable = canPreview(file.mime_type);
                return (
                  <li key={file.id} className="flex items-center gap-2 py-3 sm:gap-3">
                    {viewable ? (
                      <button
                        type="button"
                        onClick={() => openViewer(file)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-control text-left hover:text-foreground"
                        aria-label={`Open ${file.file_name}`}
                      >
                        <FileText className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{file.file_name}</span>
                          <span className="block text-xs text-muted">{formatBytes(file.size_bytes)}</span>
                        </span>
                      </button>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <FileText className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{file.file_name}</p>
                          <p className="text-xs text-muted">{formatBytes(file.size_bytes)}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex shrink-0 items-center gap-0.5">
                      {viewable && (
                        <button type="button" onClick={() => openViewer(file)} className="flex h-10 w-10 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-foreground" aria-label={`Preview ${file.file_name}`} title="Preview">
                          <Eye className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                      <button type="button" onClick={() => downloadFile(file)} className="flex h-10 w-10 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-foreground" aria-label={`Download ${file.file_name}`} title="Download">
                        <Download className="h-4 w-4" aria-hidden />
                      </button>
                      {canEdit && (
                        <button type="button" onClick={() => setFileToRemove(file)} className="flex h-10 w-10 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-error" aria-label={`Remove ${file.file_name}`} title="Remove">
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {reviewer.description && !editing && (
            <Card title="About this reviewer">
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{reviewer.description}</p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Study" description="Track time spent on this reviewer">
            <Button variant={studySession ? 'secondary' : 'mint'} className="w-full" onClick={toggleStudy}>
              {studySession ? <><Square className="h-4 w-4" aria-hidden /> Stop session</> : <><Play className="h-4 w-4" aria-hidden /> Start studying</>}
            </Button>
            {studySession && <p className="mt-2 text-xs text-muted" role="status">Session in progress. Stop it to save your time.</p>}
            <div className="mt-4 grid gap-2">
              <Link to={`/flashcards`} className={buttonClasses('secondary', 'justify-start')}>Flashcards</Link>
              <Link to={`/ai?reviewer=${reviewer.id}`} className={buttonClasses('lavender', 'justify-start')}>Generate AI study tools</Link>
              <Link to={`/quizzes`} className={buttonClasses('secondary', 'justify-start')}>Quizzes</Link>
            </div>
          </Card>

          {isOwner && (
            <Card title="Sharing" description="Control who can see and edit this reviewer">
              <Field id="visibility" label="Visibility" hint={VISIBILITY_OPTIONS[reviewer.visibility].hint}>
                <select
                  id="visibility"
                  className={inputClass}
                  value={reviewer.visibility}
                  onChange={(e) => handleVisibility(e.target.value as Visibility)}
                >
                  {visibilityValues.map((value) => (
                    <option key={value} value={value}>{VISIBILITY_OPTIONS[value].label}</option>
                  ))}
                </select>
              </Field>

              <div className="mt-5 border-t border-border pt-5">
                <p className="mb-2 text-sm font-medium">Share with a person</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="Username"
                    placeholder="username"
                    value={shareName}
                    onChange={(e) => setShareName(e.target.value)}
                    className={inputClass}
                  />
                  <select aria-label="Permission" value={sharePermission} onChange={(e) => setSharePermission(e.target.value as SharePermission)} className={`${inputClass} sm:w-32`}>
                    <option value="viewer">Can view</option>
                    <option value="editor">Can edit</option>
                  </select>
                  <Button variant="lavender" onClick={handleAddShare} loading={shareBusy} className="shrink-0">
                    <UserPlus className="h-4 w-4" aria-hidden /> Add
                  </Button>
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {shares.length === 0 && <li className="text-sm text-muted">Not shared with anyone yet.</li>}
                {shares.map((share) => (
                  <li key={share.id} className="flex items-center justify-between gap-2 rounded-control bg-surface-muted px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <span className="truncate">@{shareNameById.get(share.shared_with) ?? 'user'}</span>
                      <span className="shrink-0 text-xs text-muted">{share.permission === 'editor' ? 'Can edit' : 'Can view'}</span>
                    </span>
                    <button type="button" onClick={() => handleRevoke(share.id)} className="shrink-0 text-xs font-medium text-error hover:underline">
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {viewing && (
        <FileViewer
          file={viewing}
          onClose={closeViewer}
          onDownloadError={(text) => setNotice({ tone: 'error', text })}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this reviewer?"
        description="This removes the reviewer, its files, and any collections, shares, and flashcard links that depend on it. This can't be undone."
        confirmLabel="Delete reviewer"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={fileToRemove !== null}
        title="Delete this file?"
        description={fileToRemove ? `${fileToRemove.file_name} will be permanently deleted from REVI, including its stored copy. This can't be undone.` : ''}
        confirmLabel="Delete file"
        danger
        loading={removingFile}
        onConfirm={handleRemoveFile}
        onCancel={() => setFileToRemove(null)}
      />
      <CameraCaptureDialog
        open={cameraOpen}
        onCapture={(file) => {
          setCameraOpen(false);
          void uploadPickedFiles([file]);
        }}
        onClose={() => setCameraOpen(false)}
        onFallback={() => {
          setCameraOpen(false);
          captureInputRef.current?.click();
        }}
      />
      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleUploadMore}
      />
    </div>
  );
}
