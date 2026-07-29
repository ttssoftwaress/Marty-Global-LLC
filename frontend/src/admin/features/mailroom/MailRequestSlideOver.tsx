import { useId, useRef, useState } from 'react';
import { ChevronDown, FileText, TriangleAlert, XCircle } from 'lucide-react';

import { useOverlay } from '../../../hooks/useOverlay';
import { formatOrderDate } from '../../lib/format';
import type {
  MailRequestDetail,
  MailRequestResolution,
} from '../../types/mailroom';
import { MailRequestTypeBadge } from './MailRequestBadges';

/*
 * A pending request opened from the queue. One overlay, two chromes by
 * viewport:
 *   - tablet/desktop: a slide-over panel entering from the right — rounded left
 *     edge, `shadow-slide-over`, scrim behind, and the Esc-hinted close the
 *     design draws in the header
 *   - mobile: the same content as a sheet rising from the bottom, rounded along
 *     its top edge and capped short of the top so the queue stays visible
 *     behind it
 *
 * The body is the same at every width — document card, details rows, then the
 * form — because the design is one panel whose only difference across the links
 * is which edge it enters from.
 *
 * The two request types share this component rather than splitting into two:
 * the links are the same panel with three differences, all of which are
 * conditional here — forwarding shows a shipping-address row and collects a
 * tracking number and carrier; shredding drops the address, adds the
 * irreversible-action warning, and turns the footer button red.
 *
 * States the design does not draw, filled in here (Design.md): the detail
 * fetch's loading and error cases, a disabled "Preview document" while the scan
 * has no presigned URL yet, an in-flight footer button, and a read-only view for
 * a request that is already completed — that one has nothing left to submit, so
 * the form and footer are replaced by a closing action.
 *
 * Overlay behaviour the design implies: scrim click and Esc close, focus moves
 * into the panel, background scroll locks, and both entrances respect reduced
 * motion.
 */

type MailRequestSlideOverProps = {
  request: MailRequestDetail;
  onClose: () => void;
  onResolve: (resolution: MailRequestResolution) => void;
  isResolving: boolean;
  errorMessage?: string | null;
};

function DetailRow({
  label,
  children,
  align = 'center',
}: {
  label: string;
  children: React.ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div
      className={`flex w-full justify-between gap-4 border-b border-gray-200 py-3 ${
        align === 'center' ? 'items-center' : 'items-start'
      }`}
    >
      <p className="shrink-0 text-body text-gray-500">{label}</p>
      {children}
    </div>
  );
}

export function MailRequestSlideOver({
  request,
  onClose,
  onResolve,
  isResolving,
  errorMessage,
}: MailRequestSlideOverProps) {
  // The wrapper holding both shells — the overlay's focus scope, so the trap
  // spans whichever of the two the breakpoint has rendered.
  const overlayRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();

  const isShredding = request.type === 'shredding';
  const isSettled = request.status === 'completed';

  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState(request.carriers[0]?.value ?? '');
  const [notes, setNotes] = useState('');

  /*
   * Both shells stay mounted because their entrance animations differ (the
   * sheet rises, the panel slides in from the right) and `content()` renders a
   * different variant into each — collapsing them into one element would cost
   * both. The overlay behaviour instead runs against the wrapper: `useOverlay`
   * filters to what is actually rendered, so the trap and the initial focus
   * land in whichever shell the breakpoint is showing and skip the hidden one.
   * That replaces the old `matchMedia` guess, which picked a shell at effect
   * time and left focus in the wrong one if the viewport crossed `md` while the
   * request was open.
   *
   * This panel holds a form, so the trap matters more here than elsewhere:
   * without it Tab walked out of the tracking-number field into the queue
   * behind the scrim.
   */
  useOverlay({ open: true, onClose, panelRef: overlayRef });

  const requestedOn = formatOrderDate(request.requestedAt);

  /*
   * Carriers are admin-managed reference data and are never seeded, so an
   * install that has not configured any leaves a forwarding request with an
   * empty picker and no way to satisfy the footer. Called out in the panel
   * rather than left as a permanently disabled button with no explanation.
   */
  const hasNoCarriers = !isShredding && request.carriers.length === 0;

  /*
   * A forwarding request is only settled once we can tell the customer where
   * their mail went, so the footer waits on a tracking number and a carrier.
   * Shredding has nothing to collect — its notes field is optional — so it can
   * be submitted as soon as the panel is open. The backend re-validates either
   * way (AGENTS.md — the guard is server-side).
   */
  const canSubmit = isShredding
    ? true
    : Boolean(trackingNumber.trim() && carrier);

  const onSubmit = () => {
    if (!canSubmit || isResolving) return;

    onResolve({
      requestId: request.id,
      ...(isShredding
        ? {}
        : { trackingNumber: trackingNumber.trim(), carrier }),
      notes: notes.trim() || undefined,
    });
  };

  const submitLabel = isShredding ? 'Mark as shredded' : 'Mark as forwarded';

  /*
   * The panel's content, rendered into whichever of the two shells below the
   * viewport calls for. Shared as one tree because the links draw the same
   * panel at every width — only the edge it enters from changes.
   *
   * `variant` scopes the field ids: both shells are in the DOM at once (one is
   * display:none at any width), so an unscoped id would appear twice and every
   * label would point at whichever copy came first.
   */
  const content = (variant: 'sheet' | 'panel') => {
    const ids = {
      tracking: `${fieldId}-${variant}-tracking`,
      carrier: `${fieldId}-${variant}-carrier`,
      notes: `${fieldId}-${variant}-notes`,
    };

    return (
      <>
        {/* Header — who and what, with the Esc-hinted close */}
        <header className="flex w-full shrink-0 items-center justify-between gap-4 border-b border-gray-200 p-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/*
             * The room joins the identity line: settling a request means acting
             * on post that arrived at one specific address, and a customer may
             * hold several.
             */}
            <p className="truncate text-h6 text-text">
              {request.customer.name}
            </p>
            <p className="truncate text-small text-gray-500">
              {request.room.name}
              <span className="px-1 text-gray-300" aria-hidden="true">
                •
              </span>
              {request.mailItem}
              <span className="px-1 text-gray-300" aria-hidden="true">
                •
              </span>
              Requested {requestedOn}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-text"
            >
              <XCircle
                className="size-5"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </button>
            <span className="text-caption text-gray-400" aria-hidden="true">
              Esc
            </span>
          </div>
        </header>

        {/* Body — scrolls, so a long form stays reachable above the footer */}
        <div className="flex min-h-0 w-full flex-1 flex-col gap-6 overflow-y-auto p-5">
          {/* The scan behind the request */}
          <div className="flex w-full items-center gap-4 rounded-input bg-gray-50 p-4">
            <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-[0.25rem] border border-gray-300 bg-gray-200">
              <FileText
                className="size-6 text-gray-500"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="truncate text-[0.8125rem] font-medium text-text">
                {request.document.fileName}
              </p>

              {request.document.previewUrl ? (
                <a
                  href={request.document.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 w-fit items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
                >
                  Preview document
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="The scan becomes available once it has finished processing"
                  className="flex h-10 w-fit cursor-default items-center justify-center rounded-control border border-gray-300 px-4 text-body font-semibold text-gray-400"
                >
                  Preview document
                </button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex w-full flex-col border-t border-gray-200">
            <DetailRow label="Request type">
              <MailRequestTypeBadge
                type={request.type}
                label={request.typeLabel}
              />
            </DetailRow>

            <DetailRow label="Date requested">
              <p className="text-body text-text">{requestedOn}</p>
            </DetailRow>

            {/* Only forwarding ships anywhere, so only forwarding shows this. */}
            {!isShredding && request.shippingAddress ? (
              <DetailRow label="Shipping address" align="start">
                <p className="max-w-[16.25rem] text-right text-body text-text">
                  {request.shippingAddress}
                </p>
              </DetailRow>
            ) : null}
          </div>

          {isShredding ? (
            <div className="flex w-full items-start gap-3 rounded-input border border-error bg-[var(--color-status-missing-bg)] p-4">
              <TriangleAlert
                className="size-5 shrink-0 text-error"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {/*
                Body copy is neutral, not red: the design's #7f1d1d has no
                token, and the system's red-on-`missing-bg` pair lands at 4.0:1
                — under AA for 13px. The red border and icon carry the alarm.
              */}
              <p className="min-w-0 flex-1 text-[0.8125rem] leading-[1.125rem] text-text">
                This mail item will be marked as securely destroyed. This action
                is irreversible.
              </p>
            </div>
          ) : null}

          {isSettled ? (
            <p className="text-body text-gray-500">
              This request has been settled — there is nothing left to work on
              it.
            </p>
          ) : (
            <div className="flex w-full flex-col gap-6">
              {/* Forwarding collects where the mail went; shredding does not. */}
              {!isShredding ? (
                <>
                  <div className="flex w-full flex-col gap-2">
                    <label
                      htmlFor={ids.tracking}
                      className="text-form-label text-gray-800"
                    >
                      Tracking number
                    </label>
                    <input
                      id={ids.tracking}
                      type="text"
                      value={trackingNumber}
                      onChange={(event) =>
                        setTrackingNumber(event.target.value)
                      }
                      placeholder="e.g. 9400 1000 0000 0000 0000 00"
                      className="input-field px-3.5"
                    />
                  </div>

                  <div className="flex w-full flex-col gap-2">
                    <label
                      htmlFor={ids.carrier}
                      className="text-form-label text-gray-800"
                    >
                      Carrier
                    </label>
                    {/*
                     * A native select, so mobile gets the platform's own wheel
                     * picker; the design's chevron is drawn over it from the
                     * icon library rather than left to the browser's default
                     * (Design.md — never hand-roll or export a glyph).
                     */}
                    <div className="relative w-full">
                      <select
                        id={ids.carrier}
                        value={carrier}
                        onChange={(event) => setCarrier(event.target.value)}
                        className="input-field appearance-none px-3.5 pr-11"
                      >
                        {request.carriers.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-gray-500"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </div>

                    {hasNoCarriers ? (
                      <p className="text-small text-gray-500">
                        No mail carriers are configured yet. Add one under
                        Settings before forwarding this request.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}

              <div className="flex w-full flex-col gap-2">
                <label
                  htmlFor={ids.notes}
                  className="text-form-label text-gray-800"
                >
                  Internal notes
                </label>
                <textarea
                  id={ids.notes}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder={
                    isShredding
                      ? 'Reason for destruction or reference notes'
                      : 'Add internal notes about this shipment'
                  }
                  className="input-field h-[6.25rem] resize-none px-3 py-3"
                />
              </div>

              {errorMessage ? (
                <p role="alert" className="text-small text-error">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer — the one action, raised on its shadow above the scrolling body */}
        <footer className="w-full shrink-0 border-t border-gray-200 bg-white p-5">
          {isSettled ? (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary w-full"
            >
              Close
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit || isResolving}
              className={`btn w-full disabled:cursor-default disabled:bg-gray-300 disabled:text-white disabled:hover:bg-gray-300 ${
                isShredding ? 'btn-danger' : 'btn-primary'
              }`}
            >
              {isResolving ? 'Saving…' : submitLabel}
            </button>
          )}
        </footer>
      </>
    );
  };

  const label = `${request.typeLabel} request from ${request.customer.name}`;

  /*
   * Two shells rather than one element with breakpoint-swapped transforms: an
   * `@starting-style` value is read once at first render, so a `md:starting:`
   * override would sit alongside the mobile one instead of replacing it, and the
   * two entrances would fight. Rendering the panel in the shell its viewport
   * calls for keeps each entrance to a single starting transform — the same call
   * the portal's notifications panel makes.
   */
  return (
    <div ref={overlayRef} tabIndex={-1} className="fixed inset-0 z-50 outline-none">
      <div
        className="absolute inset-0 bg-gray-900/50 transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile — a sheet rising from the bottom, capped short of the top */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[92svh] translate-y-0 flex-col overflow-clip rounded-t-modal bg-white outline-none transition-transform duration-300 ease-out starting:translate-y-full motion-reduce:transition-none md:hidden"
      >
        {content('sheet')}
      </section>

      {/* Tablet & desktop — the design's panel entering from the right */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 hidden w-[30rem] translate-x-0 flex-col overflow-clip rounded-l-modal bg-white shadow-slide-over outline-none transition-transform duration-300 ease-out starting:translate-x-full motion-reduce:transition-none md:flex lg:w-[32.5rem]"
      >
        {content('panel')}
      </section>
    </div>
  );
}
