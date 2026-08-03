import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Loader2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

import { useOverlay } from '@/hooks/useOverlay';

/*
 * Cropping a profile picture before it is uploaded.
 *
 * The avatar is drawn as a circle everywhere in the portal, so a photo picked
 * straight from a camera roll used to be centred and cover-cropped by CSS with
 * no say from the customer — a portrait shot lost its head. This dialog gives
 * them the crop instead: pan, zoom, confirm, and only the square they chose is
 * re-encoded and uploaded.
 *
 * It is done here rather than with a cropping library because the stack is a
 * fixed budget (AGENTS.md, Tech Stack) and the whole of the work is a canvas
 * `drawImage` with one source rectangle.
 *
 * The pixel values below are measured layout, not design sizes — the stage is
 * sized in rem by Tailwind and read back with a ResizeObserver, so the compact
 * density scheme still scales it (Design.md). Only the crop arithmetic is px.
 */

// The stored square. Larger than any place the portal draws an avatar, so the
// image stays sharp on a retina screen without carrying a camera-sized file.
const OUTPUT_SIZE = 512;

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
// One arrow press, in stage pixels. Shift multiplies it for a coarse nudge.
const NUDGE = 8;

type Natural = { width: number; height: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/*
 * PNG keeps its own encoder so a logo-style picture with a transparent corner
 * survives the round trip; everything else is written as JPEG, which is a
 * fraction of the size for a photograph and is what a camera roll offers.
 */
function outputTypeFor(file: File) {
  return file.type === 'image/png'
    ? { mimeType: 'image/png', extension: 'png', quality: undefined }
    : { mimeType: 'image/jpeg', extension: 'jpg', quality: 0.9 };
}

type AvatarCropDialogProps = {
  /* The picked file. `null` closes the dialog — it holds no state of its own
   * between openings, so each pick starts centred at 1×. */
  file: File | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  isSaving?: boolean;
  /* The upload's error, surfaced here so a failed save keeps the crop rather
   * than throwing the customer back to the picker. */
  error?: string | null;
};

export function AvatarCropDialog({
  file,
  onCancel,
  onConfirm,
  isSaving = false,
  error = null,
}: AvatarCropDialogProps) {
  const open = file !== null;

  const panelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<Natural | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stageSize, setStageSize] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isCropping, setIsCropping] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  useOverlay({ open, onClose: onCancel, panelRef });

  /*
   * One object URL per file, revoked when the file changes or the dialog
   * unmounts — a blob URL is a live reference to the bytes, so leaving it
   * pinned keeps a phone-sized photo in memory for the rest of the session.
   */
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setNatural(null);
    setLoadFailed(false);
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setCropError(null);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The crop maths needs the stage's real size, and the stage is sized in rem
  // (and reflows between the mobile sheet and the desktop panel), so it is
  // measured rather than assumed.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!open || !stage) return;

    setStageSize(stage.clientWidth);

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setStageSize(entry.contentRect.width);
    });
    observer.observe(stage);

    return () => observer.disconnect();
  }, [open]);

  /*
   * `cover` is the scale at which the photo exactly fills the stage; zoom is a
   * multiple of it, so 1× is always "no empty corner" whatever the aspect ratio
   * and the crop can never include a gap.
   */
  const cover =
    natural && stageSize > 0
      ? Math.max(stageSize / natural.width, stageSize / natural.height)
      : 1;
  const scale = cover * zoom;
  const displayWidth = natural ? natural.width * scale : 0;
  const displayHeight = natural ? natural.height * scale : 0;

  const clampOffset = useCallback(
    (next: { x: number; y: number }) => {
      const maxX = Math.max(0, (displayWidth - stageSize) / 2);
      const maxY = Math.max(0, (displayHeight - stageSize) / 2);
      return {
        x: clamp(next.x, -maxX, maxX),
        y: clamp(next.y, -maxY, maxY),
      };
    },
    [displayWidth, displayHeight, stageSize],
  );

  // Rendered from the clamped value rather than the stored one, so a zoom-out
  // that shrinks the pannable area can never leave the image mid-slide.
  const position = clampOffset(offset);

  const panBy = (dx: number, dy: number) =>
    setOffset((prev) => clampOffset({ x: prev.x + dx, y: prev.y + dy }));

  const zoomTo = (next: number) => setZoom(clamp(next, MIN_ZOOM, MAX_ZOOM));

  const reset = () => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  };

  /*
   * Pointer handling covers mouse drag, one-finger pan, and two-finger pinch
   * from the one set of events — a touch device gets the gesture it expects and
   * the zoom slider stays as the keyboard-reachable equivalent.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const pinchDistance = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!natural) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      pinch.current = { distance: pinchDistance(), zoom };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.current.size >= 2) {
      const start = pinch.current;
      if (start && start.distance > 0) {
        zoomTo(start.zoom * (pinchDistance() / start.distance));
      }
      return;
    }

    panBy(event.clientX - previous.x, event.clientY - previous.y);
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  /*
   * Wheel-to-zoom is registered by hand because React's wheel listener is
   * passive: `preventDefault` there is ignored, and the panel behind would
   * scroll under the cursor while the photo zoomed.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!open || !stage) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((prev) => clamp(prev - event.deltaY * 0.002, MIN_ZOOM, MAX_ZOOM));
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [open]);

  const onStageKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? NUDGE * 4 : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };

    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    panBy(move[0], move[1]);
  };

  /*
   * The crop itself: one square out of the source image, drawn at the size the
   * portal stores. The stage shows exactly `stageSize / scale` source pixels,
   * and the offset moves the source rectangle in the opposite direction.
   */
  const confirm = async () => {
    const image = imageRef.current;
    if (
      !file ||
      !image ||
      !natural ||
      stageSize === 0 ||
      isCropping ||
      isSaving
    )
      return;

    setCropError(null);
    setIsCropping(true);

    try {
      const sourceSize = stageSize / scale;
      const sourceX = clamp(
        natural.width / 2 - (stageSize / 2 + position.x) / scale,
        0,
        Math.max(0, natural.width - sourceSize),
      );
      const sourceY = clamp(
        natural.height / 2 - (stageSize / 2 + position.y) / scale,
        0,
        Math.max(0, natural.height - sourceSize),
      );

      // Never upscale: a small source stays its own size rather than being
      // interpolated up to 512 and stored as a blurrier, larger file.
      const size = Math.max(1, Math.round(Math.min(OUTPUT_SIZE, sourceSize)));

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d context');
      context.imageSmoothingQuality = 'high';
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        size,
        size,
      );

      const { mimeType, extension, quality } = outputTypeFor(file);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mimeType, quality),
      );
      if (!blob) throw new Error('encode failed');

      onConfirm(
        new File([blob], `profile-photo.${extension}`, { type: mimeType }),
      );
    } catch {
      setCropError('That photo could not be prepared. Please try another one.');
    } finally {
      setIsCropping(false);
    }
  };

  if (!open) return null;

  const isReady = natural !== null && stageSize > 0;
  const isBusy = isCropping || isSaving;
  const message = cropError ?? error;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 opacity-100 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none md:items-center md:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        tabIndex={-1}
        className="flex max-h-full w-full max-w-[28rem] translate-y-0 flex-col gap-5 overflow-y-auto rounded-t-card bg-white p-5 outline-none transition-transform duration-300 ease-out starting:translate-y-8 motion-reduce:transition-none md:rounded-card md:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2
              id="avatar-crop-title"
              className="text-[1.25rem] font-semibold leading-7 text-text"
            >
              Crop your photo
            </h2>
            <p className="text-small text-gray-500">
              Drag to reposition and zoom until it looks right.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-input text-gray-400 hover:bg-gray-100 hover:text-text"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {loadFailed ? (
          <div className="flex flex-col items-center gap-2 rounded-card bg-gray-50 px-6 py-12 text-center">
            <p className="text-body font-semibold text-text">
              That image could not be opened
            </p>
            <p className="text-small text-gray-500">
              The file may be damaged or in a format this browser cannot read.
              Try another photo.
            </p>
          </div>
        ) : (
          <>
            {/* The crop stage. The circle is only a mask — the square behind it
                is what gets stored, and the portal rounds it at render. */}
            <div
              ref={stageRef}
              role="group"
              aria-label="Photo crop area. Drag to reposition, or use the arrow keys to nudge it."
              tabIndex={0}
              onKeyDown={onStageKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              className={`relative mx-auto aspect-square w-full max-w-[18rem] touch-none select-none overflow-hidden rounded-card bg-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-primary md:max-w-[20rem] ${
                isReady ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              {objectUrl ? (
                <img
                  ref={imageRef}
                  src={objectUrl}
                  alt=""
                  draggable={false}
                  onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (naturalWidth === 0 || naturalHeight === 0) {
                      setLoadFailed(true);
                      return;
                    }
                    setNatural({ width: naturalWidth, height: naturalHeight });
                  }}
                  onError={() => setLoadFailed(true)}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                  style={{
                    width: isReady ? `${displayWidth}px` : undefined,
                    height: isReady ? `${displayHeight}px` : undefined,
                    transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
                    visibility: isReady ? 'visible' : 'hidden',
                  }}
                />
              ) : null}

              {isReady ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)] ring-2 ring-white/80"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 animate-pulse bg-gray-200"
                />
              )}
            </div>

            {/* Zoom — the slider is the keyboard and screen-reader equivalent of
                pinching, so the gesture is never the only way to reach it. */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => zoomTo(zoom - ZOOM_STEP)}
                disabled={!isReady || zoom <= MIN_ZOOM}
                aria-label="Zoom out"
                className="flex size-9 shrink-0 items-center justify-center rounded-input border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ZoomOut
                  className="size-4"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                disabled={!isReady}
                onChange={(event) => zoomTo(Number(event.target.value))}
                aria-label="Zoom"
                className="h-1.5 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => zoomTo(zoom + ZOOM_STEP)}
                disabled={!isReady || zoom >= MAX_ZOOM}
                aria-label="Zoom in"
                className="flex size-9 shrink-0 items-center justify-center rounded-input border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ZoomIn
                  className="size-4"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            </div>
          </>
        )}

        {message ? (
          <p role="alert" className="text-small text-error">
            {message}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={reset}
            disabled={
              !isReady ||
              (zoom === MIN_ZOOM && position.x === 0 && position.y === 0)
            }
            className="inline-flex h-11 items-center gap-2 rounded-input px-3 text-small font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <RotateCcw
              className="size-4"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            Reset
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 rounded-input px-4 text-body font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={!isReady || isBusy}
              className={`inline-flex h-11 items-center gap-2 rounded-input px-5 text-body font-semibold transition-colors ${
                isReady && !isBusy
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              {isBusy ? (
                <Loader2
                  className="size-4 animate-spin"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              ) : null}
              {isSaving ? 'Saving…' : 'Save photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
