import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowsRotate, Camera, X } from '../../icons';
import { Alert } from '../common/Forms';
import { Button } from '../common/Button';

type Facing = 'environment' | 'user';

interface CameraCaptureDialogProps {
  open: boolean;
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Opens the device's own camera app or file picker when the browser camera can't be used. */
  onFallback: () => void;
}

function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was blocked. Allow camera access for this site in your browser settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError') {
    return 'The camera is being used by another app. Close it and try again.';
  }
  return 'Could not open the camera.';
}

/** Live camera preview with a capture button. Produces a JPEG File that goes through the same checks as any other file. */
export function CameraCaptureDialog({ open, onCapture, onClose, onFallback }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
  }, []);

  // Start or restart the camera whenever the dialog opens or the camera direction changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError('This browser can\u2019t open the camera here. Use your device camera instead.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(describeCameraError(err));
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facing, stopStream]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !capturing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, capturing, onClose]);

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError('The camera isn\u2019t ready yet. Try again in a moment.');
      return;
    }
    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture the photo.');
      // Front camera previews are mirrored, so the saved photo is mirrored too to match what the user saw.
      if (facing === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Could not capture the photo.');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      onCapture(new File([blob], `camera-${stamp}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
    } catch {
      setError('Could not capture the photo. Try again.');
    } finally {
      setCapturing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-overlay/50 p-4 sm:items-center" onClick={() => !capturing && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-title"
        className="my-auto w-full max-w-lg rounded-card border border-border bg-surface p-5 shadow-sm sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="camera-title" className="text-base font-semibold">Take a photo</h2>
          <button type="button" onClick={onClose} disabled={capturing} className="rounded-control p-1 text-muted hover:bg-surface-muted hover:text-foreground" aria-label="Close camera">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 aspect-[4/3] w-full overflow-hidden rounded-control bg-foreground/90">
          {!error && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label="Camera preview"
              className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
            />
          )}
          {error && (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-surface">{error}</div>
          )}
        </div>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onFallback}>
              <Camera className="h-4 w-4" aria-hidden /> Use device camera
            </Button>
            {!error && (
              <Button variant="ghost" onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))} disabled={!ready || capturing} aria-label="Switch camera">
                <ArrowsRotate className="h-4 w-4" aria-hidden /> Switch
              </Button>
            )}
          </div>
          <Button onClick={takePhoto} loading={capturing} disabled={!ready || !!error}>
            <Camera className="h-4 w-4" aria-hidden /> Capture
          </Button>
        </div>
      </div>
    </div>
  );
}
