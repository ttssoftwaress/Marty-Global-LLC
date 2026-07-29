import { useState } from 'react';
import { Trash2 } from 'lucide-react';

/*
 * A list row's actions, with delete's confirmation inline in the row.
 *
 * A destructive action needs a second step, but a modal for one row is heavier
 * than the decision: pressing delete flips this into "Delete / Cancel" in place,
 * so the row the admin is looking at is unambiguously the row being removed.
 * The row's other actions (Manage, Edit) are passed as children and hidden while
 * the confirmation shows — the choice on offer is yes or no, and a table cell is
 * only so wide.
 *
 * Availability is the caller's business and the rule for it lives on the server:
 * every list that renders this reads a `canDelete` off the API row and renders
 * the plain children instead when it is false. A greyed-out delete would invite
 * a click that can only ever be refused.
 *
 * Business settings has its own older copy of this pattern for locations and
 * carriers; this is the shared one the catalog and the two field registries use.
 */

type RowActionsProps = {
  // What is being deleted — the accessible name, so a screen reader announces
  // which row's button this is.
  name: string;
  isDeleting: boolean;
  onDelete: () => void;
  // The row's non-destructive actions, shown beside delete and replaced by the
  // confirmation while it is open.
  children?: React.ReactNode;
};

export function RowActions({
  name,
  isDeleting,
  onDelete,
  children,
}: RowActionsProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onDelete();
          }}
          disabled={isDeleting}
          className="rounded-control px-3 py-1.5 text-body font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
          <span className="sr-only"> {name}</span>
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-control px-3 py-1.5 text-body font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {children}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${name}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
