import { useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { useDismissablePopover } from '../../hooks/useDismissablePopover';
import type { SupportStatus } from '../../types/support';

/*
 * The conversation's status capsule — a tinted pill that opens a menu of the
 * states staff can move a thread to.
 *
 * The links tint it two ways: desktop and tablet use the info blue for Open,
 * mobile uses a green pill with a leading dot. One state should not read as two
 * different things, so the tint is driven by the state at every width (logged as
 * a deviation): Open is the info blue both wider links use, and the leading dot
 * mobile introduces is kept everywhere as a second, non-colour cue.
 *
 * The design draws only the closed capsule; the menu is a state it did not
 * cover. It closes on outside click and on Escape — which returns focus to the
 * capsule rather than stranding it on the removed list — and the current status
 * is marked so the open menu says which one is live. A non-modal popover, so it
 * deliberately leaves page scroll and Tab alone.
 */

const STATUS_STYLES: Record<SupportStatus, { pill: string; dot: string }> = {
  open: { pill: 'status-info', dot: 'bg-info' },
  pending: { pill: 'status-review', dot: 'bg-warning' },
  resolved: { pill: 'status-approved', dot: 'bg-success' },
};

const STATUS_OPTIONS: { value: SupportStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
];

type SupportStatusMenuProps = {
  status: SupportStatus;
  label: string;
  onChange: (status: SupportStatus) => void;
};

export function SupportStatusMenu({
  status,
  label,
  onChange,
}: SupportStatusMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useDismissablePopover({
    open,
    onClose: () => setOpen(false),
    containerRef: rootRef,
    triggerRef,
  });

  const styles = STATUS_STYLES[status];

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Conversation status: ${label}. Change status`}
        className={`flex h-10 items-center gap-1.5 rounded-pill px-3 text-[0.8125rem] font-semibold transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:h-auto md:rounded-md md:px-2 md:py-1 md:text-caption lg:h-10 lg:rounded-input lg:px-3 lg:text-[0.8125rem] ${styles.pill}`}
      >
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full md:size-1.5 lg:size-2 ${styles.dot}`}
        />
        {label}
        <ChevronDown
          className="size-3 shrink-0 md:size-2.5 lg:size-3"
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Conversation status"
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-40 overflow-hidden rounded-input border border-gray-200 bg-white py-1 shadow-md-elevation"
        >
          {STATUS_OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === status}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-small text-gray-700 transition-colors hover:bg-gray-50"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${STATUS_STYLES[option.value].dot}`}
                  />
                  {option.label}
                </span>
                {option.value === status ? (
                  <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
