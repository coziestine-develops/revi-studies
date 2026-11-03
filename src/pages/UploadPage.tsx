import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2, X } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { createReviewer, uploadReviewerFile } from '../services/reviewers';
import { errorMessage } from '../lib/format';
import { ReviewerForm } from '../components/reviewers/ReviewerForm';
import { Card } from '../components/common/Card';
import { buttonClasses } from '../components/common/Button';
import type { ReviewerFormValues } from '../schemas/forms';

type UploadState = 'pending' | 'uploading' | 'done' | 'failed';

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ name: string; state: UploadState; message?: string }[]>([]);

  async function handleSubmit(values: ReviewerFormValues, files: File[]) {
    if (!user) return;
    setBusy(true);
    setError(null);

    let reviewerId: string;
    try {
      const reviewer = await createReviewer(values, user.id);
      reviewerId = reviewer.id;
      setCreatedId(reviewer.id);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }

    setProgress(files.map((file) => ({ name: file.name, state: 'pending' as const })));
    let failures = 0;

    for (let index = 0; index < files.length; index++) {
      setProgress((current) => current.map((item, i) => (i === index ? { ...item, state: 'uploading' } : item)));
      try {
        await uploadReviewerFile(reviewerId, user.id, files[index]);
        setProgress((current) => current.map((item, i) => (i === index ? { ...item, state: 'done' } : item)));
      } catch (err) {
        failures += 1;
        const message = errorMessage(err);
        setProgress((current) => current.map((item, i) => (i === index ? { ...item, state: 'failed', message } : item)));
      }
    }

    queryClient.invalidateQueries({ queryKey: ['reviewers'] });
    queryClient.invalidateQueries({ queryKey: ['all-reviewer-files'] });
    setBusy(false);

    if (failures === 0) {
      navigate(`/reviewers/${reviewerId}`);
    } else {
      setError(`${failures} ${failures === 1 ? 'file' : 'files'} couldn't be uploaded. Your reviewer was saved; open it to add the missing files.`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Upload a reviewer</h1>
        <p className="mt-1 text-sm text-muted">Add a title, choose who can see it, and attach your study files.</p>
      </header>

      <Card>
        <ReviewerForm
          defaultValues={{ title: '', subject: '', description: '', tags: '', visibility: 'private' }}
          submitLabel="Create reviewer"
          loading={busy}
          allowFiles
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/library')}
        />
      </Card>

      {progress.length > 0 && (
        <Card title="Upload progress" description="Each file uploads separately and is checked on the server.">
          <ul className="space-y-2">
            {progress.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-3.5 py-2.5 text-sm">
                <span className="truncate">{item.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs font-medium">
                  {item.state === 'pending' && <span className="text-muted">Waiting</span>}
                  {item.state === 'uploading' && <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Uploading</>}
                  {item.state === 'done' && <><Check className="h-3.5 w-3.5 text-success" aria-hidden /> Uploaded</>}
                  {item.state === 'failed' && <><X className="h-3.5 w-3.5 text-error" aria-hidden /> {item.message}</>}
                </span>
              </li>
            ))}
          </ul>
          {createdId && !busy && (
            <Link to={`/reviewers/${createdId}`} className={`${buttonClasses('secondary')} mt-4`}>Open reviewer</Link>
          )}
        </Card>
      )}
    </div>
  );
}
