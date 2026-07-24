import { useMemo, useState } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type { MailItem } from '../../types/mailroom';
import { isStorageExpiringSoon } from './expiry';
import { MailStatusChip } from './MailStatusChip';
import { ScanThumbnail } from './ScanThumbnail';
import { StorageExpiryInfo } from './StorageExpiryInfo';

/*
 * The mail items list — two presentations of one list, swapped by breakpoint (a
 * table row can't reflow into a card, so each renders its own markup, the same
 * approach the orders/payment lists take):
 *   - desktop (lg): full table — select · preview · sender · received · storage
 *                   expires · status · action
 *   - tablet (md):  the same table, folding the received date under the sender
 *                   and dropping the standalone RECEIVED column
 *   - mobile:       one card per item — preview + sender/status + received &
 *                   expiry meta, an action-deadline banner where relevant, and a
 *                   full-width action button
 *
 * Row checkboxes are wired to a real selection (select-all + per-row) with a
 * selected-row highlight and a live count in the meta bar; bulk actions land
 * with the backend. Desktop pages a window through the loaded items; mobile
 * shows the whole loaded set. An amber, bold "storage expires" with an alert
 * icon flags items nearing their shred date. The design shows a populated list;
 * the empty and loading states are added so a filter with no matches, or a
 * first load, explains itself.
 */

// Amber warning text (approaching shred date / action reason). Uses the review
// status token (#b45309) — dark enough for AA contrast on white, where the
// warning token (#f59e0b) the mobile link used would fail. The `color:` hint
// keeps Tailwind from reading the var as a font-size.
const AMBER = 'text-[color:var(--color-status-review-text)]';

type MailListProps = {
  items: MailItem[]; // full loaded set — mobile renders all of it
  roomId: string;
  page: number; // 1-based desktop window
  pageSize: number;
  totalItems: number;
  isLoading?: boolean;
};

function itemHref(roomId: string, itemId: string) {
  return `/app/mailroom/${roomId}/${itemId}`;
}

function RowAction({
  item,
  roomId,
  fullWidth,
}: {
  item: MailItem;
  roomId: string;
  fullWidth?: boolean;
}) {
  const width = fullWidth ? 'w-full' : 'w-full lg:w-auto lg:min-w-[80px]';
  const base = `inline-flex items-center justify-center rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-colors lg:rounded-[10px] ${width}`;

  if (item.status === 'action_requested') {
    return (
      <Link
        to={itemHref(roomId, item.id)}
        className={`${base} bg-primary text-white hover:bg-primary-hover`}
      >
        Respond
      </Link>
    );
  }
  return (
    <Link
      to={itemHref(roomId, item.id)}
      className={`${base} border border-primary bg-white text-primary hover:bg-primary-light`}
    >
      View
    </Link>
  );
}

function ExpiresValue({ iso }: { iso: string }) {
  const soon = isStorageExpiringSoon(iso);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-body ${
        soon ? `font-semibold ${AMBER}` : 'font-normal text-gray-600'
      }`}
    >
      {formatOrderDate(iso)}
      {soon ? (
        <AlertTriangle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      ) : null}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[24px] bg-gray-100">
        <Inbox className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">No mail here yet</p>
      <p className="max-w-[360px] text-body text-gray-500">
        Nothing matches this view. Try another status, clear your search, or
        check back once new mail is scanned.
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-card" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-12 w-full animate-pulse rounded-input bg-gray-200" />
      ))}
    </div>
  );
}

const HEADER_CLASS =
  'text-caption font-medium uppercase tracking-[0.4px] text-gray-500';

export function MailList({
  items,
  roomId,
  page,
  pageSize,
  totalItems,
  isLoading,
}: MailListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isEmpty = !isLoading && items.length === 0;
  const showSkeleton = Boolean(isLoading) && items.length === 0;

  // Desktop/tablet show one page window into the loaded set; mobile shows all.
  const windowStart = (page - 1) * pageSize;
  const windowItems = useMemo(
    () => items.slice(windowStart, windowStart + pageSize),
    [items, windowStart, pageSize],
  );

  const windowIds = windowItems.map((item) => item.id);
  const allSelected = windowIds.length > 0 && windowIds.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) windowIds.forEach((id) => next.delete(id));
      else windowIds.forEach((id) => next.add(id));
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const shownFrom = totalItems === 0 ? 0 : windowStart + 1;
  const shownTo = Math.min(totalItems, windowStart + windowItems.length);

  return (
    <section className="flex w-full flex-col gap-4">
      {/* Meta / selection bar — tablet & desktop */}
      <div className="hidden min-h-5 items-center justify-between md:flex">
        {selected.size > 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-small font-semibold text-primary">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-small font-medium text-gray-500 hover:text-text"
            >
              Clear
            </button>
          </div>
        ) : (
          <p className="text-small text-gray-500">
            Showing {shownFrom}–{shownTo} of {totalItems} items
          </p>
        )}
      </div>

      {/* Mobile — one card per item */}
      <div className="flex w-full flex-col gap-3 md:hidden">
        {showSkeleton ? (
          <div className="rounded-card border border-gray-200 bg-white">
            <SkeletonRows />
          </div>
        ) : isEmpty ? (
          <div className="rounded-card border border-gray-200 bg-white">
            <EmptyState />
          </div>
        ) : (
          items.map((item) => {
            const soon = isStorageExpiringSoon(item.storageExpiresAt);
            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
              >
                <div className="flex gap-3">
                  <div
                    className="h-[52px] w-10 shrink-0 rounded-lg bg-gray-200"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-body font-semibold text-text">
                        {item.sender}
                      </p>
                      <MailStatusChip status={item.status} />
                    </div>
                    <p className="text-small text-gray-500">
                      Received {formatOrderDate(item.receivedAt)}
                    </p>
                    {soon ? (
                      <p className={`flex items-center gap-1 text-small font-semibold ${AMBER}`}>
                        <AlertTriangle className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                        Expires {formatOrderDate(item.storageExpiresAt)}
                      </p>
                    ) : (
                      <p className="text-small text-gray-400">
                        Expires {formatOrderDate(item.storageExpiresAt)}
                      </p>
                    )}
                  </div>
                </div>

                {item.status === 'action_requested' && item.responseDueAt ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-[var(--color-status-review-bg)] p-2">
                    <AlertTriangle className={`size-3.5 shrink-0 ${AMBER}`} strokeWidth={2} aria-hidden="true" />
                    <span className={`text-caption font-medium ${AMBER}`}>
                      Response needed by {formatOrderDate(item.responseDueAt)}
                    </span>
                  </div>
                ) : null}

                <div className="h-px w-full bg-gray-200" />
                <RowAction item={item} roomId={roomId} fullWidth />
              </div>
            );
          })
        )}
      </div>

      {/* Tablet & desktop — card-wrapped table */}
      <div className="hidden w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)] text-left align-middle">
              <th scope="col" className="w-[44px] pl-4 lg:pl-6">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all mail on this page"
                  disabled={windowIds.length === 0}
                  className="size-[18px] cursor-pointer rounded-[4px] accent-primary"
                />
              </th>
              <th scope="col" className={`w-[52px] lg:w-[80px] ${HEADER_CLASS}`}>
                Preview
              </th>
              <th scope="col" className={HEADER_CLASS}>
                Sender
              </th>
              <th scope="col" className={`hidden w-[140px] lg:table-cell ${HEADER_CLASS}`}>
                Received
              </th>
              <th scope="col" className="w-[124px] lg:w-[180px]">
                <span className={`inline-flex items-center gap-1 ${HEADER_CLASS}`}>
                  Storage expires
                  <StorageExpiryInfo />
                </span>
              </th>
              <th scope="col" className={`w-[124px] lg:w-[160px] ${HEADER_CLASS}`}>
                Status
              </th>
              <th
                scope="col"
                className={`w-[80px] pr-4 text-right lg:w-[120px] lg:pr-6 ${HEADER_CLASS}`}
              >
                Action
              </th>
            </tr>
          </thead>

          {!showSkeleton && !isEmpty && (
            <tbody>
              {windowItems.map((item) => {
                const isSelected = selected.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`h-16 border-b border-gray-200 last:border-b-0 lg:h-[72px] ${
                      isSelected ? 'bg-primary-light' : 'bg-white'
                    }`}
                  >
                    <td className="pl-4 lg:pl-6">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(item.id)}
                        aria-label={`Select mail from ${item.sender}`}
                        className="size-[18px] cursor-pointer rounded-[4px] accent-primary"
                      />
                    </td>

                    <td>
                      <ScanThumbnail ready={item.scanReady} />
                    </td>

                    <td className="min-w-0 pr-2">
                      <p className="truncate text-body font-semibold text-text">
                        {item.sender}
                      </p>
                      {item.note ? (
                        <p className={`truncate text-small font-medium ${AMBER}`}>
                          {item.note}
                        </p>
                      ) : null}
                      <p className="truncate text-small text-gray-500 lg:hidden">
                        Received: {formatOrderDate(item.receivedAt)}
                      </p>
                    </td>

                    <td className="hidden text-body text-gray-600 lg:table-cell">
                      {formatOrderDate(item.receivedAt)}
                    </td>

                    <td>
                      <ExpiresValue iso={item.storageExpiresAt} />
                    </td>

                    <td>
                      <MailStatusChip status={item.status} />
                    </td>

                    <td className="pr-4 text-right lg:pr-6">
                      <div className="flex justify-end">
                        <RowAction item={item} roomId={roomId} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>

        {showSkeleton && <SkeletonRows />}
        {isEmpty && <EmptyState />}
      </div>
    </section>
  );
}
