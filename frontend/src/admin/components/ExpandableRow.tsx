import { useCallback, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

/*
 * Expandable table rows — the one implementation every admin list uses.
 *
 * The rule the whole admin area now follows: a table row carries only what a
 * reader scans by (who, what, how much, what state), and everything else lives
 * in a panel that opens under the row when the row is clicked. One row is open
 * at a time — opening a second closes the first — because these lists are read
 * by comparing neighbours, and two open panels push the row being compared
 * against off the fold.
 *
 * Why in place rather than a dialog: an operator works a queue by scanning it
 * and drilling into two or three entries. A modal per row means losing the scan
 * position on every one, which is the position the reader is actually here for.
 * The audit log proved the pattern; this file is that pattern made shared.
 *
 * Lazy by construction. The detail panel is only MOUNTED while its row is open,
 * so a detail query inside it does not run until then — a hundred-row page
 * fetches one row's detail, not a hundred. That is why `DetailPanel` takes the
 * query's own `isPending`/`isError` rather than deriving them from absent data
 * (Design.md — a loading state that cannot be told from a failed one is a bug).
 *
 * The row is a real toggle: `aria-expanded` + `aria-controls`, a tab stop, and
 * Enter/Space activation, so the enlarged target is not pointer-only. No `role`
 * is set on the `<tr>` — `role="button"` may not contain interactive
 * descendants (every row holds at least one control) and would drop the row out
 * of the table's structure. The element keeps its native role and gains the
 * behaviour, the same reasoning as `features/orders/rowNavigation.ts`.
 */

/*
 * The accordion state. One id or none — the "close the other one" rule is this
 * single line, rather than a Set every caller has to prune.
 */
export function useExpandedRow() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const collapse = useCallback(() => setExpandedId(null), []);

  return { expandedId, toggle, collapse };
}

/*
 * A control inside an expandable row — a link, a checkbox, an action button —
 * stops its own click so pressing it does not also toggle the panel.
 */
export const stopRowToggle = (event: MouseEvent) => event.stopPropagation();

/*
 * Inset outline: a row sits flush against its neighbours, so an outward offset
 * would be clipped by the frame or overlap the row above.
 */
export const EXPAND_ROW_FOCUS_CLASS =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

export const detailPanelId = (prefix: string, id: string) =>
  `${prefix}-detail-${id}`;

type ExpandRowPropsArgs = {
  isExpanded: boolean;
  panelId: string;
  onToggle: () => void;
  /** Named for the screen reader — "Show details for ORD-2026-1f2a". */
  label: string;
};

/*
 * The props a row spreads to become a toggle.
 *
 * A click that ends a text selection is someone copying a reference, not
 * opening a panel, so it is ignored — the same guard the order rows use. The
 * keydown only fires when the row itself holds focus; a key press inside a
 * nested control belongs to that control.
 */
export function expandRowProps({
  isExpanded,
  panelId,
  onToggle,
  label,
}: ExpandRowPropsArgs) {
  return {
    tabIndex: 0,
    'aria-expanded': isExpanded,
    'aria-controls': panelId,
    'aria-label': label,
    onClick: () => {
      if (window.getSelection()?.toString()) return;
      onToggle();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onToggle();
    },
  };
}

/** The tint an open row carries, so the panel reads as belonging to it. */
export const expandedRowClass = (isExpanded: boolean) =>
  `cursor-pointer transition-colors ${EXPAND_ROW_FOCUS_CLASS} ${
    isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50 active:bg-gray-100'
  }`;

/*
 * The chevron. Presentational — the row itself is the control, so this is
 * `aria-hidden` and never a second tab stop announcing the same state twice.
 */
export function ExpandChevron({ isExpanded }: { isExpanded: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-control border transition-colors ${
        isExpanded
          ? 'border-primary bg-primary-light text-primary'
          : 'border-gray-200 bg-white text-gray-500'
      }`}
    >
      <ChevronDown
        className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        strokeWidth={2}
      />
    </span>
  );
}

/** The trailing cell every expandable table ends with. */
export function ExpandChevronCell({
  isExpanded,
  className = '',
}: {
  isExpanded: boolean;
  className?: string;
}) {
  return (
    <td className={`py-3 pr-4 lg:pr-6 ${className}`}>
      <div className="flex justify-end">
        <ExpandChevron isExpanded={isExpanded} />
      </div>
    </td>
  );
}

/*
 * The panel's row. A `<td colSpan>` rather than a positioned overlay, so the
 * panel scrolls with the table and the row above keeps its column alignment.
 */
export function DetailRow({
  panelId,
  colSpan,
  children,
}: {
  panelId: string;
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr className="bg-gray-50">
      <td id={panelId} colSpan={colSpan} className="px-4 pb-4 pt-0 lg:px-6">
        {children}
      </td>
    </tr>
  );
}

function DetailSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-input border border-gray-200 bg-white p-4"
    >
      <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className="h-2.5 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-input border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2 text-body text-text">
        <AlertCircle
          className="mt-0.5 size-4 shrink-0 text-error"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        {message}
      </span>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 whitespace-nowrap rounded-control border border-primary bg-white px-3 py-1.5 text-small font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/*
 * The panel body, with the three states a fetched panel owes (Design.md):
 * loading in the panel's own shape, an error that says what failed and offers a
 * retry, and the content itself. `isPending`/`isError` come from the query, not
 * from "the data is absent".
 */
export function DetailPanel({
  isPending,
  isError,
  errorMessage = 'Could not load these details.',
  onRetry,
  children,
}: {
  isPending?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isPending) return <DetailSkeleton />;
  if (isError) return <DetailError message={errorMessage} onRetry={onRetry} />;

  return (
    <div className="flex flex-col gap-4 rounded-input border border-gray-200 bg-white p-4">
      {children}
    </div>
  );
}

/* --- Panel layout ------------------------------------------------------- */

const TERM =
  'text-caption font-semibold uppercase tracking-[0.6px] text-gray-500';

/** A labelled group inside a panel — the panel's own second-level heading. */
export function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-gray-200 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <p className={TERM}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

/** The four-up field grid the panels share, so every one reads the same. */
export function DetailGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </dl>
  );
}

/*
 * One field. An absent value prints an em dash rather than hiding the field, so
 * the grid does not reflow between rows and "we have no value" stays
 * distinguishable from "this record has no such field".
 */
export function DetailField({
  label,
  children,
  mono = false,
}: {
  label: string;
  children?: ReactNode;
  mono?: boolean;
}) {
  const empty =
    children === null || children === undefined || children === '' || children === false;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className={TERM}>{label}</dt>
      <dd
        className={`min-w-0 break-words text-body text-text ${
          mono ? 'font-mono text-small' : ''
        }`}
      >
        {empty ? <span className="text-gray-400">—</span> : children}
      </dd>
    </div>
  );
}

/** Free prose inside a panel — a message, a note, an instruction block. */
export function DetailNote({ children }: { children: ReactNode }) {
  return (
    <p className="whitespace-pre-wrap rounded-input bg-gray-50 p-3 text-body text-text">
      {children}
    </p>
  );
}

/** The row of links/buttons a panel ends with. */
export function DetailActions({ children }: { children: ReactNode }) {
  return (
    <div
      onClick={stopRowToggle}
      className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4"
    >
      {children}
    </div>
  );
}

export const detailActionClass =
  'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-input border border-primary bg-white px-4 text-small font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const detailActionMutedClass =
  'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-input border border-gray-300 bg-white px-4 text-small font-semibold text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
