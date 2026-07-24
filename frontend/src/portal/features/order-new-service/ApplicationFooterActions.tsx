import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';

/*
 * Step 2's footer — Back, a "what happens after you submit" reassurance note,
 * and the Submit CTA. The three links arrange these three differently, so this
 * renders two structural blocks that Tailwind shows one of per breakpoint:
 *
 *   - desktop (lg): one row across the content — Back (outline) left, the lock
 *     note centered (capped width), Submit (accent) right.
 *   - tablet (md): the lock note on its own full-width line, then a row with
 *     Back left and Submit right.
 *   - mobile: the lock note centered in the scrolling flow, and a sticky bottom
 *     bar pinned to the viewport with an icon-only square Back beside a
 *     flex-grow Submit.
 *
 * Copy is the desktop link's, the source of truth across viewports. Submit is
 * disabled until the required fields are answered (`canSubmit`), matching the
 * quote-request flow — the button is wired, the actual submission lands with the
 * backend endpoint.
 */

const LOCK_NOTE =
  'After you submit, our team reviews your application and sends a quote with a secure payment link.';

type ApplicationFooterActionsProps = {
  onBack: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  isSubmitting?: boolean;
};

function LockNote({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Lock className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      <p className="text-small text-text-secondary">{LOCK_NOTE}</p>
    </div>
  );
}

export function ApplicationFooterActions({
  onBack,
  onSubmit,
  canSubmit,
  isSubmitting = false,
}: ApplicationFooterActionsProps) {
  const submitLabel = isSubmitting ? 'Submitting…' : 'Submit application';
  const submitDisabled = !canSubmit || isSubmitting;

  return (
    <>
      {/* md+ in-flow footer. Tablet: note above the button row. Desktop: all
          three on one row via the lg overrides. */}
      <div className="hidden flex-col gap-5 md:flex lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <LockNote className="lg:order-2 lg:max-w-[500px] lg:justify-center" />

        <div className="flex items-center justify-between gap-4 lg:contents">
          <button
            type="button"
            onClick={onBack}
            className="btn btn-secondary rounded-input px-6 lg:order-1"
          >
            <ArrowLeft className="mr-2 size-4" strokeWidth={2} aria-hidden="true" />
            Back
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="btn btn-accent rounded-input px-6 disabled:cursor-not-allowed disabled:opacity-50 lg:order-3"
          >
            {submitLabel}
            <ArrowRight className="ml-2 size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile: the note sits in the scrolling flow; the buttons live in the
          sticky bar below. */}
      <LockNote className="justify-center px-2 py-2 text-center md:hidden" />

      {/* Mobile sticky action bar — icon-only Back + full-width Submit. It's
          `sticky bottom-0` in the scrolling workspace so it rides above the
          content without covering the sidebar; hidden from md up where the
          in-flow footer takes over. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.08)] md:hidden">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-12 shrink-0 items-center justify-center rounded-input border border-primary bg-white text-primary transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="size-5" strokeWidth={2} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="btn btn-accent flex-1 rounded-input disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
          <ArrowRight className="ml-2 size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
