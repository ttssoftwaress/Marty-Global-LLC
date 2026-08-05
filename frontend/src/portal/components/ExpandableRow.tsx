import { useCallback, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

/*
 * Expandable table rows — the one implementation every portal list uses.
 *
 * The rule the portal now follows: a row carries only what the customer scans
 * by (what it is, when, how much, what state), and everything else opens in a
 * panel under the row when the row is clicked. One row is open at a time —
 * opening a second closes the first — so the list never turns into a wall and
 * the row being compared against stays on screen.
 *
 * Lazy by construction. The panel is only MOUNTED while its row is open, so a
 * detail query inside it does not run until then: a page of twenty payments
 * fetches one payment's detail, not twenty. `DetailPanel` therefore takes the
 * query's own `isPending`/`isError` rather than inferring them from absent data
 * (Design.md — a loading state that cannot be told from a failed one is a bug).
 *
 * The row is a real toggle: `aria-expanded` + `aria-controls`, a tab stop, and
 * Enter/Space activation, so the enlarged target is not pointer-only. No `role`
 * is set on the `<tr>` — `role="button"` may not contain interactive
 * descendants (rows hold links and download buttons) and would drop the row out
 * of the table's structure. The element keeps its native role and gains the
 * behaviour.
 *
 * This is a deliberate copy of the admin area's file, not an import: areas
 * never import from each other (AGENTS.md, route groups), so a pattern both
 * need is implemented in each.
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
 * A control inside an expandable row — a link, a checkbox, a download button —
 * stops its own click so pressing it does not also toggle the panel.
 */
export const stopRowToggle = (event: MouseEvent) => event.stopPropagation();

// Inset — a row sits flush against its neighbours, so an outward offset would be
// clipped by the card frame or overlap the row above.
export const EXPAND_ROW_FOCUS_CLASS =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

export const detailPanelId = (prefix: string, id: string) =>
  `${prefix}-detail-${id}`;

type ExpandRowPropsArgs = {
  isExpanded: boolean;
  panelId: string;
  onToggle: () => void;
  label: string;
};

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
      // A click that ends a text selection is someone copying a reference, not
      // opening a panel.
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

export function DetailGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </dl>
  );
}

/*
 * An absent value prints an em dash rather than hiding the field, so the grid
 * does not reflow between rows and "no value yet" stays distinguishable from
 * "this record has no such field".
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
    children === null ||
    children === undefined ||
    children === '' ||
    children === false;

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

export function DetailNote({ children }: { children: ReactNode }) {
  return (
    <p className="whitespace-pre-wrap rounded-input bg-gray-50 p-3 text-body text-text">
      {children}
    </p>
  );
}

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
