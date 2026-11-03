import { useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, FileText, X } from '../../icons';
import { reviewerFormSchema, visibilityValues, type ReviewerFormValues } from '../../schemas/forms';
import { ACCEPT_ATTRIBUTE, MAX_FILE_BYTES, validateFile } from '../../services/reviewers';
import { formatBytes } from '../../lib/format';
import { Alert, Field, inputClass } from '../common/Forms';
import { Button } from '../common/Button';
import { CameraCaptureDialog } from './CameraCaptureDialog';

export const VISIBILITY_OPTIONS: Record<(typeof visibilityValues)[number], { label: string; hint: string }> = {
  private: { label: 'Private', hint: 'Only you can see this reviewer.' },
  friends: { label: 'Friends', hint: 'You and friends you have accepted.' },
  shared: { label: 'Shared', hint: 'Only people you add by username.' },
  public: { label: 'Public', hint: 'Anyone signed in can find and view it in Discover.' },
};

interface ReviewerFormProps {
  defaultValues: ReviewerFormValues;
  submitLabel: string;
  loading: boolean;
  allowFiles?: boolean;
  error?: string | null;
  onSubmit: (values: ReviewerFormValues, files: File[]) => void;
  onCancel?: () => void;
}

export function ReviewerForm({ defaultValues, submitLabel, loading, allowFiles = false, error, onSubmit, onCancel }: ReviewerFormProps) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ReviewerFormValues>({
    resolver: zodResolver(reviewerFormSchema),
    defaultValues,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [fileProblems, setFileProblems] = useState<string[]>([]);
  const visibility = watch('visibility');

  const captureInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  function addPicked(picked: File[]) {
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of picked) {
      const problem = validateFile(file);
      if (problem) problems.push(`${file.name}: ${problem}`);
      else accepted.push(file);
    }
    setFiles((current) => [...current, ...accepted]);
    setFileProblems(problems);
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    addPicked(picked);
  }

  function addCapturedFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    addPicked(picked);
  }

  function openDeviceCamera() {
    setCameraOpen(false);
    captureInputRef.current?.click();
  }

  return (
    <>
    <form onSubmit={handleSubmit((values) => onSubmit(values, files))} noValidate className="space-y-5">
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field id="title" label="Title" error={errors.title?.message}>
            <input id="title" className={inputClass} placeholder="e.g. Research Methods midterm" aria-invalid={!!errors.title} {...register('title')} />
          </Field>
        </div>
        <Field id="subject" label="Subject" error={errors.subject?.message}>
          <input id="subject" className={inputClass} placeholder="e.g. Psychology" aria-invalid={!!errors.subject} {...register('subject')} />
        </Field>
        <Field id="tags" label="Tags" hint="Separate with commas. Up to 10." error={errors.tags?.message}>
          <input id="tags" className={inputClass} placeholder="exam, chapter-3" aria-invalid={!!errors.tags} {...register('tags')} />
        </Field>
        <div className="md:col-span-2">
          <Field id="description" label="Description" error={errors.description?.message}>
            <textarea id="description" rows={3} className={inputClass} placeholder="What does this cover?" aria-invalid={!!errors.description} {...register('description')} />
          </Field>
        </div>
        <Field id="visibility" label="Visibility" hint={VISIBILITY_OPTIONS[visibility]?.hint}>
          <select id="visibility" className={inputClass} {...register('visibility')}>
            {visibilityValues.map((value) => (
              <option key={value} value={value}>{VISIBILITY_OPTIONS[value].label}</option>
            ))}
          </select>
        </Field>
      </div>

      {allowFiles && (
        <div className="space-y-3">
          <div>
            <label htmlFor="files" className="mb-1.5 block text-sm font-medium">Files</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                id="files"
                type="file"
                multiple
                accept={ACCEPT_ATTRIBUTE}
                onChange={addFiles}
                className="block min-w-0 flex-1 text-sm text-muted file:mr-4 file:rounded-control file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              />
              <Button variant="secondary" onClick={() => setCameraOpen(true)} className="shrink-0">
                <Camera className="h-4 w-4" aria-hidden /> Take photo
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted">PDF, DOCX, PPTX, PNG, JPG, WEBP, or TXT. Up to {formatBytes(MAX_FILE_BYTES)} each. Use Take photo to capture notes or a page with your camera. AI tools read the text in PDF, DOCX, PPTX, and TXT files. Scanned images aren't read yet.</p>
          </div>
          {fileProblems.length > 0 && (
            <Alert>{fileProblems.join(' ')}</Alert>
          )}
          {files.length > 0 && (
            <ul className="divide-y divide-border rounded-control border border-border">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted">{formatBytes(file.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    className="rounded-control p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>}
        <Button type="submit" loading={loading}>{loading ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
    <CameraCaptureDialog
      open={cameraOpen}
      onCapture={(file) => {
        setCameraOpen(false);
        addPicked([file]);
      }}
      onClose={() => setCameraOpen(false)}
      onFallback={openDeviceCamera}
    />
    <input
      ref={captureInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      onChange={addCapturedFile}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
    />
    </>
  );
}
