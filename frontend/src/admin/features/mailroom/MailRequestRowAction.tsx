import { isRequestActionable } from '../../lib/mail-requests';
import type { MailRequestRow } from '../../types/mailroom';

/*
 * A queue row's single control.
 *
 * The design draws two states and this reproduces both: a filled navy
 * "Process" while there is still work on the request, and an outlined navy
 * "View" once it is completed.
 *
 * Both open the detail slide-over — the difference is what waits inside it, not
 * whether it opens. An outstanding request cannot be settled from a row: a
 * forwarding job needs the tracking number and carrier, and a shredding job
 * needs its irreversible-action confirmation, all of which live in the panel.
 * So "Process" hands the row to the panel and the operator settles it there.
 *
 * States the design does not cover, filled in here (Design.md): the button
 * disables itself while its own request is being claimed and prints "Working…",
 * so a double tap cannot claim the same request twice. `isBusy` is passed per
 * row rather than read from the shared mutation, so opening one row does not
 * disable every other row's button.
 *
 * The button steps between the links exactly as drawn — 40px tall and 100px
 * wide on desktop, 32px by 72px on tablet — and stretches full-width inside a
 * mobile card, where it is the card's one target.
 */

type MailRequestRowActionProps = {
  request: MailRequestRow;
  isBusy: boolean;
  onOpen: (request: MailRequestRow) => void;
  fullWidth?: boolean;
};

export function MailRequestRowAction({
  request,
  isBusy,
  onOpen,
  fullWidth = false,
}: MailRequestRowActionProps) {
  const actionable = isRequestActionable(request.status);

  const base = `flex h-8 items-center justify-center whitespace-nowrap rounded-[0.5rem] text-[0.8125rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:h-10 lg:rounded-control lg:text-body ${
    fullWidth ? 'w-full' : 'w-[4.5rem] lg:w-[6.25rem]'
  }`;

  if (!actionable) {
    return (
      <button
        type="button"
        onClick={() => onOpen(request)}
        aria-label={`View ${request.customer.name}'s ${request.typeLabel.toLowerCase()} request`}
        className={`${base} border border-primary bg-white text-primary hover:bg-primary-light`}
      >
        View
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(request)}
      disabled={isBusy}
      aria-label={`Process ${request.customer.name}'s ${request.typeLabel.toLowerCase()} request`}
      className={`${base} bg-primary text-white hover:bg-primary-hover disabled:cursor-default disabled:bg-gray-300 disabled:hover:bg-gray-300`}
    >
      {isBusy ? 'Working…' : 'Process'}
    </button>
  );
}
