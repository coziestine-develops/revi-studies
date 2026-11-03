import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, X } from '../../icons';
import type { ReviewerFile } from '../../types/database';
import { downloadFileBlob, saveFileToDevice } from '../../services/reviewers';
import { docxToHtml, pptxSlideTexts, viewerKindOf, VIEWER_KIND_LABEL, type SlideText, type ViewerKind } from '../../lib/fileViewer';
import { errorMessage, formatBytes } from '../../lib/format';
import { Alert } from '../common/Forms';
import { Skeleton } from '../common/Skeleton';
import { PdfView } from './PdfView';

interface FileViewerProps {
  file: ReviewerFile;
  onClose: () => void;
  onDownloadError: (message: string) => void;
}

/**
 * Full-screen viewer for a reviewer file. It fills the screen on phones and sits in a large
 * panel on tablets and desktops. The same renderers are used everywhere, so the file looks
 * the same on every device.
 */
export function FileViewer({ file, onClose, onDownloadError }: FileViewerProps) {
  const kind = viewerKindOf(file.mime_type);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Load the file once per file. A refresh of the file list doesn't reload it.
  useEffect(() => {
    let cancelled = false;
    setBlob(null);
    setError(null);
    downloadFileBlob(file)
      .then((loaded) => {
        if (!cancelled) setBlob(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
    // Only the identity of the stored file matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, file.storage_path]);

  // The page behind doesn't scroll while the viewer is open. Focus starts on Close.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Escape closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveFileToDevice(file);
    } catch (err) {
      onDownloadError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-overlay/80 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Viewing ${file.file_name}`}
        onClick={(event) => event.stopPropagation()}
        className="flex min-h-0 w-full flex-col overflow-hidden bg-background md:h-[min(92dvh,900px)] md:max-w-5xl md:rounded-card md:border md:border-border md:shadow-lg"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] md:rounded-t-card md:px-4 md:pt-3">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-foreground hover:bg-surface-muted"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{file.file_name}</p>
            <p className="truncate text-xs text-muted">
              {kind ? VIEWER_KIND_LABEL[kind] : 'File'} · {formatBytes(file.size_bytes)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            aria-label={`Download ${file.file_name}`}
            className="flex h-10 shrink-0 items-center gap-2 rounded-control border border-border px-3 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{saving ? 'Saving…' : 'Download'}</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          {error && <div className="p-4"><Alert>{`This file couldn't be opened. ${error}`}</Alert></div>}
          {!error && !blob && <div className="p-4"><Skeleton className="h-64 w-full" /></div>}
          {!error && blob && <ViewerBody kind={kind} blob={blob} fileName={file.file_name} />}
        </div>
      </div>
    </div>
  );
}

function ViewerBody({ kind, blob, fileName }: { kind: ViewerKind | null; blob: Blob; fileName: string }) {
  if (kind === 'pdf') return <PdfView blob={blob} />;
  if (kind === 'image') return <ImageView blob={blob} fileName={fileName} />;
  if (kind === 'text') return <TextView blob={blob} />;
  if (kind === 'docx') return <DocxView blob={blob} />;
  if (kind === 'pptx') return <PptxView blob={blob} />;
  return (
    <div className="p-6 text-center text-sm text-muted">
      This file type can't be previewed here. Use Download to open it on your device.
    </div>
  );
}

function ImageView({ blob, fileName }: { blob: Blob; fileName: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="flex min-h-full items-center justify-center p-3">
      <img src={url} alt={fileName} className="max-h-[80dvh] w-auto max-w-full rounded-control object-contain" />
    </div>
  );
}

function TextView({ blob }: { blob: Blob }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    blob
      .text()
      .then((value) => !cancelled && setText(value))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [blob]);
  if (error) return <div className="p-4"><Alert>{error}</Alert></div>;
  if (text === null) return <div className="p-4"><Skeleton className="h-64 w-full" /></div>;
  return (
    <pre className="min-h-full whitespace-pre-wrap break-words p-4 font-sans text-sm leading-relaxed text-foreground sm:p-6">
      {text || 'This file is empty.'}
    </pre>
  );
}

function DocxView({ blob }: { blob: Blob }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    blob
      .arrayBuffer()
      .then(docxToHtml)
      .then((value) => !cancelled && setHtml(value))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [blob]);
  if (error) return <div className="p-4"><Alert>{error}</Alert></div>;
  if (html === null) return <div className="p-4"><Skeleton className="h-64 w-full" /></div>;
  return (
    <article
      className="file-doc mx-auto max-w-3xl p-5 text-sm leading-relaxed text-foreground sm:p-8"
      // The HTML was produced from the document and passed through sanitizeHtml.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PptxView({ blob }: { blob: Blob }) {
  const [slides, setSlides] = useState<SlideText[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    blob
      .arrayBuffer()
      .then(pptxSlideTexts)
      .then((value) => !cancelled && setSlides(value))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [blob]);
  if (error) return <div className="p-4"><Alert>{error}</Alert></div>;
  if (slides === null) return <div className="p-4"><Skeleton className="h-64 w-full" /></div>;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <p className="rounded-control bg-surface-muted px-3 py-2 text-xs text-muted">
        Text from each slide. Pictures and layout aren't shown here. Download the file for the full slides.
      </p>
      {slides.length === 0 && <p className="text-center text-sm text-muted">No slides found in this file.</p>}
      {slides.map((slide) => (
        <section key={slide.number} aria-label={`Slide ${slide.number}`} className="rounded-card border border-border bg-surface p-4 shadow-sm sm:p-5">
          <p className="mb-2 text-xs font-semibold text-muted">Slide {slide.number}</p>
          {slide.paragraphs.length === 0 ? (
            <p className="text-sm italic text-muted">No text on this slide.</p>
          ) : (
            slide.paragraphs.map((paragraph, index) => (
              <p key={index} className="mt-1.5 text-sm leading-relaxed first:mt-0">{paragraph}</p>
            ))
          )}
        </section>
      ))}
    </div>
  );
}
