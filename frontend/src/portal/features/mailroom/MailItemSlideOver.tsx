import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MinusCircle,
  PlusCircle,
  ScanLine,
  X,
} from 'lucide-react';

import { formatOrderDate } from '../../lib/format';
import type { MailItem } from '../../types/mailroom';

/*
 * A mail item opened from a room's inbox. One overlay, two chromes by viewport:
 *   - tablet/desktop: a slide-over panel entering from the right (rounded left
 *     edge, scrim behind) — pagination chevrons + "2 of 6" and an Esc-hinted
 *     close up top, the scan toolbar (page counter + zoom) over the pages, and
 *     the action footer
 *   - mobile: the same content as a full-screen sheet — a back-arrow header bar
 *     with the "2 of 6" counter, the zoom controls floating over the scan, and
 *     the footer raised on its shadow
 *
 * The design's document preview is dummy content; the real scan arrives as
 * presigned page images on the item (short-TTL, AGENTS.md Security & PII), so
 * the body renders the pages when they're here, a loading pulse while the
 * detail fetch is in flight, and a "Scan in progress" state while the item is
 * still being scanned (same vocabulary as ScanThumbnail). Zoom scales the page
 * width (50–200%); with several pages, the counter tracks the page under the
 * viewport middle.
 *
 * Overlay behaviour the design implies is filled in: scrim click / Esc / the
 * back arrow close, ArrowLeft/ArrowRight step through the list, focus moves
 * into the panel, background scroll locks, and the slide-in respects reduced
 * motion. "Mark as read" shows only while the item is `new`; "Download PDF"
 * enables once the backend serves the file.
 */

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

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
    <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-[4px] border border-dashed border-gray-300 bg-white p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-[24px] bg-gray-100">
        <ScanLine className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">Scan in progress</p>
      <p className="max-w-[280px] text-body text-gray-500">
        This item is still being scanned. The pages will appear here once
        it&apos;s ready.
      </p>
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
}: MailItemSlideOverProps) {
  const panelRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const pages = item.scanPages ?? null;
  const hasPages = Boolean(pages && pages.length > 0);
  const pageCount = pages?.length ?? 0;
  // Ready with no pages yet means the detail fetch is still in flight.
  const scanLoading = item.scanReady && pages === null;

  // Focus the panel and lock background scroll for the overlay's lifetime, then
  // hand focus back to whatever opened the item so closing doesn't strand the
  // keyboard at the top of the document.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, []);

  /*
   * Esc closes (the header hints it); arrow keys step through the list. Tab is
   * trapped inside the panel: this is a modal `role="dialog"`, but the list and
   * top bar behind the scrim stay focusable, so without this Tab walks out of
   * the dialog while the scrim still blocks the mouse.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft' && hasPrev) onPrev();
      else if (event.key === 'ArrowRight' && hasNext) onNext();
      else if (event.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;

        const focusable = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  // Reset the viewer when stepping to another item.
  useEffect(() => {
    setZoom(1);
    setCurrentPage(1);
    scrollerRef.current?.scrollTo({ top: 0, left: 0 });
  }, [item.id]);

  // With several pages, keep "Page X of Y" on the page under the viewport
  // middle as the scan scrolls.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || pageCount < 2) return;

    const updateCurrentPage = () => {
      const midpoint =
        scroller.getBoundingClientRect().top + scroller.clientHeight / 2;
      let closest = 1;
      let closestDistance = Number.POSITIVE_INFINITY;
      scroller.querySelectorAll('[data-scan-page]').forEach((page, index) => {
        const rect = page.getBoundingClientRect();
        const contains = rect.top <= midpoint && rect.bottom >= midpoint;
        const distance = contains
          ? 0
          : Math.min(Math.abs(rect.top - midpoint), Math.abs(rect.bottom - midpoint));
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = index + 1;
        }
      });
      setCurrentPage(closest);
    };

    scroller.addEventListener('scroll', updateCurrentPage, { passive: true });
    return () => scroller.removeEventListener('scroll', updateCurrentPage);
  }, [pageCount, item.id]);

  const zoomOut = () => setZoom((level) => Math.max(ZOOM_MIN, level - ZOOM_STEP));
  const zoomIn = () => setZoom((level) => Math.min(ZOOM_MAX, level + ZOOM_STEP));

  const counter = position !== null && total > 0 ? `${position} of ${total}` : null;
  const receivedOn = formatOrderDate(item.receivedAt);

  const zoomButtons = (
    <>
      <IconButton
        label="Zoom out"
        onClick={zoomOut}
        disabled={zoom <= ZOOM_MIN}
        className="p-1"
      >
        <MinusCircle className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Zoom in"
        onClick={zoomIn}
        disabled={zoom >= ZOOM_MAX}
        className="p-1"
      >
        <PlusCircle className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </IconButton>
    </>
  );

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
        className="absolute inset-y-0 right-0 flex w-full translate-x-0 flex-col overflow-clip bg-white outline-none transition-transform duration-300 ease-out starting:translate-x-full motion-reduce:transition-none md:w-[480px] md:rounded-l-modal md:shadow-slide-over lg:w-[520px]"
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

        {/* Scan viewer */}
        <div className="relative flex min-h-0 w-full flex-1 flex-col gap-3 bg-gray-50 p-4 md:p-5">
          {hasPages ? (
            <div className="hidden w-full items-center justify-between md:flex">
              <p className="text-small text-gray-500">
                Page {currentPage} of {pageCount}
              </p>
              <div className="flex items-center gap-1">{zoomButtons}</div>
            </div>
          ) : null}

          <div ref={scrollerRef} className="min-h-0 w-full flex-1 overflow-auto">
            {hasPages && pages ? (
              <div
                className="mx-auto flex flex-col gap-4"
                style={{ width: `${zoom * 100}%` }}
              >
                {pages.map((pageUrl, index) => (
                  <div
                    key={pageUrl}
                    data-scan-page
                    className="w-full overflow-clip rounded-[4px] border border-gray-200 bg-white shadow-sm-elevation md:border-0"
                  >
                    <img
                      src={pageUrl}
                      alt={`${item.sender} — scanned page ${index + 1} of ${pageCount}`}
                      loading="lazy"
                      className="block w-full"
                    />
                  </div>
                ))}
              </div>
            ) : scanLoading ? (
              <div
                className="aspect-[3/4] w-full animate-pulse rounded-[4px] bg-gray-200"
                aria-hidden="true"
              />
            ) : (
              <ScanProcessingState />
            )}
          </div>

          {hasPages ? (
            <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-pill border border-gray-200 bg-white px-1.5 py-0.5 shadow-md-elevation md:hidden">
              {zoomButtons}
            </div>
          ) : null}
        </div>

        {/* Action footer */}
        <footer className="flex w-full shrink-0 flex-col gap-3 border-t border-gray-200 bg-white p-4 shadow-footer-raised md:p-5 md:shadow-none">
          {requestError ? (
            <p role="alert" className="text-small text-error">
              {requestError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onRequestForwarding}
            disabled={isRequesting}
            className="btn btn-primary w-full md:text-body disabled:opacity-50"
          >
            {isRequesting ? 'Sending request…' : 'Request forwarding'}
          </button>
          <div className="flex w-full gap-3 md:gap-2">
            <button
              type="button"
              onClick={onRequestShredding}
              disabled={isRequesting}
              className="btn btn-secondary min-w-0 flex-1 px-2 text-body disabled:opacity-50"
            >
              Request shredding
            </button>
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
