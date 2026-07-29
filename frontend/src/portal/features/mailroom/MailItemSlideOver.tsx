import { useEffect, useRef, type ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  ScanLine,
  X,
} from 'lucide-react';

import { useOverlay } from '@/hooks/useOverlay';
import { formatOrderDate } from '../../lib/format';
import type { MailItem, MailItemFile } from '../../types/mailroom';

/*
 * A mail item opened from a room's inbox. One overlay, two chromes by viewport:
 *   - tablet/desktop: a slide-over panel entering from the right (rounded left
 *     edge, scrim behind) — pagination chevrons + "2 of 6" and an Esc-hinted
 *     close up top, the attached scans below, and the action footer
 *   - mobile: the same content as a full-screen sheet — a back-arrow header bar
 *     with the "2 of 6" counter and the footer raised on its shadow
 *
 * The scan is not drawn inline. The body lists the files the operator attached,
 * each with a "Preview document" button that opens that file in a new tab —
 * the same affordance the staff panel uses (MailRequestSlideOver), and the same
 * short-TTL presigned URLs (AGENTS.md Security & PII). The inline viewer this
 * replaced tried to render page images with its own zoom and page tracking; the
 * browser's own viewer does the job, handles PDFs, and leaves nothing to go
 * stale when a presigned link expires mid-session.
 *
 * The body still distinguishes the states the list cannot: the detail fetch in
 * flight, that fetch having failed, and an item the operator has not scanned
 * yet ("Scan in progress", the same vocabulary as ScanThumbnail).
 *
 * Overlay behaviour the design implies is filled in: scrim click / Esc / the
 * back arrow close, ArrowLeft/ArrowRight step through the list, focus moves
 * into the panel, background scroll locks, and the slide-in respects reduced
 * motion. "Mark as read" shows only while the item is `new`; "Download PDF"
 * enables once the backend serves the file.
 */

type MailItemSlideOverProps = {
  item: MailItem;
  roomName: string; // "Main Office" — the header's received line
  position: number | null; // 1-based place in the visible list — null hides "2 of 6"
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRequestForwarding?: () => void;
  onRequestShredding?: () => void;
  onMarkRead?: () => void;
  // Fires alongside the actual download so the backend can log the "Downloaded
  // only" disposal — the browser still follows the link either way.
  onDownload?: () => void;
  // While a request is in flight, so the two buttons cannot be double-submitted.
  isRequesting?: boolean;
  // Set when a request was rejected — a customer with no company address on file
  // cannot be forwarded to, and the reason belongs beside the button.
  requestError?: string | null;
  /*
   * The detail fetch's real state. The panel cannot infer "still loading" from
   * the absence of files: the list copy that fills the header never carries
   * them, so a failed detail fetch is shape-identical to one in flight and the
   * pulse would run forever with no way back.
   */
  isScanLoading?: boolean;
  scanError?: boolean;
  onRetryScan?: () => void;
};

type IconButtonProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

function IconButton({
  label,
  onClick,
  disabled,
  className = 'p-1.5',
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex items-center justify-center rounded-md text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:text-gray-300 ${className}`}
    >
      {children}
    </button>
  );
}

function ScanProcessingState() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 rounded-input border border-dashed border-gray-300 bg-white p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <ScanLine className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">Scan in progress</p>
      <p className="max-w-[17.5rem] text-body text-gray-500">
        This item is still being scanned. The document will appear here once
        it&apos;s ready.
      </p>
    </div>
  );
}

/*
 * One attached file — its name and the button that opens it. Mirrors the staff
 * panel's document card so both sides of the same scan read identically.
 *
 * The link opens in a new tab rather than downloading: previewing is the common
 * case, and the footer's "Download PDF" already covers keeping a copy. It fires
 * `onDownload` all the same — the backend logs the customer having accessed the
 * scan, which is what a "Downloaded only" disposal is recorded from.
 */
function DocumentCard({
  file,
  onOpen,
}: {
  file: MailItemFile;
  onOpen?: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-4 rounded-input bg-white p-4">
      <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-[0.25rem] border border-gray-300 bg-gray-200">
        <FileText className="size-6 text-gray-500" strokeWidth={1.75} aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="truncate text-[0.8125rem] font-medium text-text">{file.name}</p>

        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          onClick={onOpen}
          className="flex h-10 w-fit items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
        >
          Preview document
        </a>
      </div>
    </div>
  );
}

function ScanErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 rounded-input border border-dashed border-gray-300 bg-white p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <ScanLine className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">We couldn&apos;t load this scan</p>
      <p className="max-w-[17.5rem] text-body text-gray-500">
        Something went wrong fetching this item&apos;s files. The link may have
        expired.
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-secondary mt-1 px-4 text-body">
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function MailItemSlideOver({
  item,
  roomName,
  position,
  total,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  onRequestForwarding,
  onRequestShredding,
  onMarkRead,
  onDownload,
  isRequesting = false,
  requestError = null,
  isScanLoading = false,
  scanError = false,
  onRetryScan,
}: MailItemSlideOverProps) {
  const panelRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const hasOpenRequest = Boolean(item.hasOpenRequest);
  /*
   * Every attached file, each opened on its own. `files` is the complete set;
   * an item whose detail predates it — or that carries only a PDF — still has
   * `pdfUrl`, so it falls back to a single card rather than reading as unscanned.
   */
  const files: MailItemFile[] =
    item.files && item.files.length > 0
      ? item.files
      : item.pdfUrl
        ? [{ name: 'Scanned document.pdf', contentType: 'application/pdf', sizeBytes: null, url: item.pdfUrl }]
        : [];
  const hasFiles = files.length > 0;
  /*
   * Four states, in priority order: files we can offer, the fetch failed, the
   * fetch is still running, or the operator hasn't scanned it yet. Loading is
   * the query's own state — deriving it from `scanReady && !files` made a
   * failed fetch indistinguishable from a pending one and pulsed forever.
   */
  const scanLoading = !hasFiles && !scanError && (isScanLoading || item.scanReady);

  // Escape, the Tab trap, focus in and back out, and the scroll lock. The
  // overlay is mounted only while open, so `open` is constant here.
  useOverlay({ open: true, onClose, panelRef });

  // Arrow keys step through the list — the viewer's own shortcut, not overlay
  // behaviour, so it stays here.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && hasPrev) onPrev();
      else if (event.key === 'ArrowRight' && hasNext) onNext();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onPrev, onNext, hasPrev, hasNext]);

  // Back to the top of the file list when stepping to another item.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0, left: 0 });
  }, [item.id]);

  const counter = position !== null && total > 0 ? `${position} of ${total}` : null;
  const receivedOn = formatOrderDate(item.receivedAt);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-gray-900/50 transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Mail from ${item.sender}`}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full translate-x-0 flex-col overflow-clip bg-white outline-none transition-transform duration-300 ease-out starting:translate-x-full motion-reduce:transition-none md:w-[30rem] md:rounded-l-modal md:shadow-slide-over lg:w-[32.5rem]"
      >
        {/* Mobile — back-arrow header bar */}
        <header className="flex h-16 w-full shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 md:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back to the mail list"
              className="shrink-0 p-1 text-text transition-colors hover:text-gray-600"
            >
              <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-body-lg font-semibold text-text">
                {item.sender}
              </p>
              <p className="truncate text-caption font-normal text-gray-500">
                Received {receivedOn}
              </p>
            </div>
          </div>
          {counter ? (
            <p className="shrink-0 text-small text-gray-500">{counter}</p>
          ) : null}
        </header>

        {/* Tablet & desktop — pagination + Esc-hinted close, then the title */}
        <header className="hidden w-full shrink-0 flex-col gap-4 border-b border-gray-200 p-5 md:flex">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <IconButton label="Previous mail item" onClick={onPrev} disabled={!hasPrev}>
                <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
              </IconButton>
              {counter ? <p className="text-small text-gray-500">{counter}</p> : null}
              <IconButton label="Next mail item" onClick={onNext} disabled={!hasNext}>
                <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
              </IconButton>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-caption font-normal text-gray-400" aria-hidden="true">
                Esc
              </span>
              <IconButton label="Close" onClick={onClose}>
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </IconButton>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="truncate text-h6 text-text">{item.sender}</p>
            <p className="truncate text-small text-gray-500">
              Received {receivedOn} · {roomName}
            </p>
          </div>
        </header>

        {/* Attached scans — one card per file, each opening in a new tab */}
        <div
          ref={scrollerRef}
          className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto bg-gray-50 p-4 md:p-5"
        >
          {hasFiles ? (
            files.map((file) => (
              <DocumentCard key={file.url} file={file} onOpen={onDownload} />
            ))
          ) : scanError ? (
            <ScanErrorState onRetry={onRetryScan} />
          ) : scanLoading ? (
            <div
              className="h-[6.5rem] w-full animate-pulse rounded-input bg-gray-200"
              aria-hidden="true"
            />
          ) : (
            <ScanProcessingState />
          )}
        </div>

        {/* Action footer */}
        <footer className="flex w-full shrink-0 flex-col gap-3 border-t border-gray-200 bg-white p-4 shadow-footer-raised md:p-5 md:shadow-none">
          {requestError ? (
            <p role="alert" className="text-small text-error">
              {requestError}
            </p>
          ) : null}

          {/*
           * With a request already open there is nothing left to ask for — the
           * backend allows one at a time and would reject a second as a
           * conflict. Say where the item stands instead of offering buttons that
           * can only fail.
           */}
          {hasOpenRequest ? (
            <p className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-status-review-bg)] px-3 py-2 text-center text-small font-medium text-[color:var(--color-status-review-text)]">
              <Clock className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              We&apos;re working on your request for this item
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={onRequestForwarding}
                disabled={isRequesting}
                className="btn btn-primary w-full md:text-body disabled:opacity-50"
              >
                {isRequesting ? 'Sending request…' : 'Request forwarding'}
              </button>
              <button
                type="button"
                onClick={onRequestShredding}
                disabled={isRequesting}
                className="btn btn-secondary w-full px-2 text-body disabled:opacity-50"
              >
                Request shredding
              </button>
            </>
          )}
          <div className="flex w-full gap-3 md:gap-2">
            {item.pdfUrl ? (
              <a
                href={item.pdfUrl}
                download
                target="_blank"
                rel="noreferrer"
                onClick={onDownload}
                className="btn btn-secondary min-w-0 flex-1 px-2 text-body"
              >
                Download PDF
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="The PDF becomes available once the scan is ready"
                className="btn btn-secondary min-w-0 flex-1 px-2 text-body opacity-50 disabled:pointer-events-none"
              >
                Download PDF
              </button>
            )}
          </div>
          {item.status === 'new' ? (
            <button
              type="button"
              onClick={onMarkRead}
              className="w-full py-1 text-center text-body font-semibold text-gray-500 transition-colors hover:text-gray-700 md:text-small md:font-medium"
            >
              Mark as read
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
