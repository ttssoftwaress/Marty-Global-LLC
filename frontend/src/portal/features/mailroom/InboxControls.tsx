import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';

import { useOverlay } from '../../../hooks/useOverlay';
import type {
  MailRoomTab,
  MailStatusFilter,
} from '../../types/mailroom';
import { InboxViewTabs } from './InboxViewTabs';

/*
 * The inbox toolbar — view switch, search, and the status filter — arranged per
 * link across one component so the page stays a clean composition:
 *   - desktop (lg): view tabs and (search + a "All statuses" dropdown) share one
 *                   justify-between row
 *   - tablet (md):  view tabs on their own full-width row, then search + dropdown
 *   - mobile:       a scrollable row of status pills, then search + a filter
 *                   button that opens a sheet (view switch + full status list —
 *                   the pills are the quick set, the sheet holds the rest, incl.
 *                   the view tabs that mobile otherwise hides)
 *
 * Search and the status filter are real controls; the backend resolves the
 * actual filtering (AGENTS.md). The Figma shows placeholder-only search, so the
 * empty state matches; the placeholder copy follows the desktop link.
 */

/*
 * Full list — the desktop dropdown and the mobile sheet. `all` reads as "All
 * statuses" here (the pills shorten it to "All").
 *
 * The links list a "Scanned" option in both sets; it is dropped because no item
 * can carry that status (portal/types/mailroom.ts) and a filter that always
 * returns nothing reads as a broken inbox rather than an empty one.
 */
const STATUS_OPTIONS: { value: MailStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'forwarded', label: 'Forwarded' },
  { value: 'action_requested', label: 'Action requested' },
  { value: 'archived', label: 'Archived' },
];

// The quick set surfaced as mobile pills (the mobile link's chips, less
// "Scanned" — same reason as above).
const PILL_OPTIONS: { value: MailStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'action_requested', label: 'Action requested' },
  { value: 'forwarded', label: 'Forwarded' },
  { value: 'archived', label: 'Archived' },
];

const VIEW_OPTIONS: { value: MailRoomTab; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'requests', label: 'Requests' },
  { value: 'history', label: 'History' },
];

type InboxControlsProps = {
  tab: MailRoomTab;
  onTabChange: (tab: MailRoomTab) => void;
  status: MailStatusFilter;
  onStatusChange: (status: MailStatusFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
};

function SearchField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex h-10 items-center gap-2 rounded-input border border-gray-300 bg-white px-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)] ${className ?? ''}`}
    >
      <Search className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by sender…"
        aria-label="Search mail by sender"
        className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
      />
    </div>
  );
}

function StatusSelect({
  status,
  onStatusChange,
}: {
  status: MailStatusFilter;
  onStatusChange: (status: MailStatusFilter) => void;
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value as MailStatusFilter)}
        aria-label="Filter by status"
        className="h-10 w-[10rem] cursor-pointer appearance-none rounded-input border border-gray-300 bg-white pl-3.5 pr-9 text-body text-gray-700 outline-none focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)]"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-500"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </div>
  );
}

function StatusPills({
  status,
  onStatusChange,
}: {
  status: MailStatusFilter;
  onStatusChange: (status: MailStatusFilter) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter by status"
      className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {PILL_OPTIONS.map(({ value, label }) => {
        const isActive = value === status;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onStatusChange(value)}
            className={`shrink-0 rounded-pill px-4 py-2 text-body font-medium transition-colors ${
              isActive ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function FilterSheet({
  id,
  tab,
  onTabChange,
  status,
  onStatusChange,
  onClose,
}: {
  id: string;
  tab: MailRoomTab;
  onTabChange: (tab: MailRoomTab) => void;
  status: MailStatusFilter;
  onStatusChange: (status: MailStatusFilter) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // It claims `aria-modal`, so it takes the full modal posture: Escape closes,
  // Tab stays inside, focus lands in the panel and returns to the filter button
  // on close, and the page behind stops scrolling.
  useOverlay({ open: true, onClose, panelRef });

  return (
    <>
      {/* Tap-away backdrop */}
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default"
      />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        tabIndex={-1}
        className="absolute right-0 top-full z-40 mt-2 w-[15rem] rounded-card border border-gray-200 bg-white p-3 shadow-lg-elevation outline-none"
      >
        <div className="flex items-center justify-between pb-1">
          <p className="text-caption font-semibold uppercase tracking-[0.4px] text-gray-500">
            Filters
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="text-gray-400 hover:text-text"
          >
            <X className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <p className="pt-1 text-caption font-medium uppercase tracking-[0.4px] text-gray-400">
          View
        </p>
        <div className="flex flex-col pt-1">
          {VIEW_OPTIONS.map((option) => (
            <SheetRow
              key={option.value}
              label={option.label}
              active={tab === option.value}
              onClick={() => onTabChange(option.value)}
            />
          ))}
        </div>

        <div className="my-2 h-px w-full bg-gray-200" />

        <p className="text-caption font-medium uppercase tracking-[0.4px] text-gray-400">
          Status
        </p>
        <div className="flex flex-col pt-1">
          {STATUS_OPTIONS.map((option) => (
            <SheetRow
              key={option.value}
              label={option.label}
              active={status === option.value}
              onClick={() => onStatusChange(option.value)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function SheetRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-between rounded-input px-2 py-2 text-left text-body transition-colors ${
        active ? 'font-semibold text-primary' : 'font-medium text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
      {active ? <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" /> : null}
    </button>
  );
}

export function InboxControls({
  tab,
  onTabChange,
  status,
  onStatusChange,
  search,
  onSearchChange,
}: InboxControlsProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetId = useId();

  // A status not surfaced as a pill (e.g. Action requested) is only reachable
  // via the sheet — flag the filter button so it doesn't look inert.
  const hiddenFilterActive = !PILL_OPTIONS.some((option) => option.value === status);

  const closeSheet = () => setSheetOpen(false);
  const handleTabChange = (next: MailRoomTab) => {
    onTabChange(next);
    closeSheet();
  };

  return (
    <>
      {/* Tablet & desktop */}
      <div className="hidden md:flex md:flex-col md:gap-3 lg:flex-row lg:items-center lg:justify-between">
        <InboxViewTabs active={tab} onChange={onTabChange} />
        <div className="flex w-full items-center gap-3 lg:w-auto">
          <SearchField
            value={search}
            onChange={onSearchChange}
            className="flex-1 lg:w-[15rem] lg:flex-none"
          />
          <StatusSelect status={status} onStatusChange={onStatusChange} />
        </div>
      </div>

      {/* Mobile */}
      <div className="relative flex flex-col gap-3 md:hidden">
        <StatusPills status={status} onStatusChange={onStatusChange} />
        <div className="flex items-center gap-2">
          <SearchField value={search} onChange={onSearchChange} className="h-11 flex-1" />
          <button
            type="button"
            onClick={() => setSheetOpen((open) => !open)}
            aria-label="Filters and views"
            aria-expanded={sheetOpen}
            aria-controls={sheetId}
            aria-haspopup="dialog"
            className={`relative flex size-11 shrink-0 items-center justify-center rounded-input border bg-white transition-colors ${
              sheetOpen ? 'border-primary text-primary' : 'border-gray-300 text-gray-500 hover:bg-gray-100'
            }`}
          >
            <SlidersHorizontal className="size-[1.125rem] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {hiddenFilterActive ? (
              <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-accent" aria-hidden="true" />
            ) : null}
          </button>
        </div>

        {sheetOpen ? (
          <FilterSheet
            id={sheetId}
            tab={tab}
            onTabChange={handleTabChange}
            status={status}
            onStatusChange={onStatusChange}
            onClose={closeSheet}
          />
        ) : null}
      </div>
    </>
  );
}
