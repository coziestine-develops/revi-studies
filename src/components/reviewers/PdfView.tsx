import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut } from '../../icons';
import { errorMessage } from '../../lib/format';
import { Alert } from '../common/Forms';
import { Skeleton } from '../common/Skeleton';

/** pdf.js is loaded on first use, so the rest of the app doesn't pay for it. */
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs() {
  pdfjsPromise ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    return lib;
  });
  return pdfjsPromise;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
/** Horizontal padding around pages inside the scroll area (12px each side). */
const PAGE_PADDING_PX = 24;

/**
 * Draws a PDF with pdf.js onto canvases instead of an iframe. Phone browsers often can't
 * show PDFs in an iframe, so this renders the same way on every device.
 */
export function PdfView({ blob }: { blob: Blob }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load the document. The refs let cleanup release whatever finished or is still loading.
  useEffect(() => {
    let cancelled = false;
    const handles: { task: PDFDocumentLoadingTask | null; doc: PDFDocumentProxy | null } = { task: null, doc: null };

    (async () => {
      const buffer = await blob.arrayBuffer();
      if (cancelled) return;
      const pdfjs = await loadPdfjs();
      if (cancelled) return;
      handles.task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
      const loaded = await handles.task.promise;
      if (cancelled) {
        void loaded.destroy();
        return;
      }
      handles.doc = loaded;
      setDoc(loaded);
    })().catch((err: unknown) => {
      if (!cancelled) setError(`This PDF couldn't be opened. ${errorMessage(err)}`);
    });

    return () => {
      cancelled = true;
      void handles.task?.destroy();
      void handles.doc?.destroy();
    };
  }, [blob]);

  // Track the available width so pages fit the screen, and refit on rotation or resize.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setWidth(Math.max(0, element.clientWidth - PAGE_PADDING_PX));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pageWidth = Math.max(120, Math.floor(width * zoom));

  return (
    <div ref={scrollRef} className="relative h-full overflow-auto overscroll-contain bg-surface-muted">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur">
        <span className="min-w-0 truncate text-xs text-muted" aria-live="polite">
          {doc ? `${doc.numPages} ${doc.numPages === 1 ? 'page' : 'pages'}` : 'Loading pages…'}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="flex h-9 w-9 items-center justify-center rounded-control text-foreground hover:bg-surface-muted disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="Fit to width"
            title="Fit to width"
            className="h-9 min-w-[3.5rem] rounded-control px-2 text-xs font-semibold tabular-nums text-foreground hover:bg-surface-muted"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="flex h-9 w-9 items-center justify-center rounded-control text-foreground hover:bg-surface-muted disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-3">
        {error && <Alert>{error}</Alert>}
        {!doc && !error && <Skeleton className="mx-auto h-64 w-full max-w-xl" />}
        {doc &&
          width > 0 &&
          Array.from({ length: doc.numPages }, (_, index) => (
            <PdfPage key={index + 1} doc={doc} pageNumber={index + 1} width={pageWidth} />
          ))}
      </div>
    </div>
  );
}

/** One page. It draws only once it's near the screen, and redraws when the width changes. */
function PdfPage({ doc, pageNumber, width }: { doc: PDFDocumentProxy; pageNumber: number; width: number }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  // Height-to-width ratio of the page, so the placeholder has the right size before it draws.
  const [aspect, setAspect] = useState(1.414);

  useEffect(() => {
    const element = holderRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '600px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    doc
      .getPage(pageNumber)
      .then((page) => {
        if (!active) return;
        const viewport = page.getViewport({ scale: 1 });
        setAspect(viewport.height / viewport.width);
      })
      .catch(() => {
        // Keep the default size. Drawing will report the problem if it persists.
      });
    return () => {
      active = false;
    };
  }, [doc, pageNumber]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas || width <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    doc
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        const context = canvas.getContext('2d');
        if (!context) return;
        task = page.render({
          canvasContext: context,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        });
        return task.promise;
      })
      .catch(() => {
        // Cancelled by a newer draw, or the page is unreadable. Leave the page blank.
      });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, width, doc, pageNumber]);

  return (
    <div
      ref={holderRef}
      className="mx-auto overflow-hidden rounded-control border border-border bg-surface shadow-sm"
      style={{ width, height: Math.round(width * aspect) }}
      aria-label={`Page ${pageNumber} of ${doc.numPages}`}
      role="img"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
