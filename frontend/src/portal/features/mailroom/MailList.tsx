import { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, Inbox, ScanLine } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  DetailRow,
  ExpandChevron,
  ExpandChevronCell,
  detailPanelId,
  expandRowProps,
  expandedRowClass,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { MailItem } from '../../types/mailroom';
import { isStorageExpiringSoon } from './expiry';
import { MailItemDetails } from './MailItemDetails';
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
 *
 * Post now arrives sealed (the mail room files the envelope, the customer
 * decides whether it is opened), so a row can be at one of three stages and the
 * list has to show which: the preview says sealed / scanning / scanned, and an
 * unopened envelope's action is "Scan" — the ask that puts it in the mail room's
 * queue — beside the "View" that opens the envelope shot.
 *
 * Clicking a row opens the two questions the columns cannot answer: whether the
 * envelope has been opened, and whether anything is expected of the customer.
 * The scan itself stays in the viewer — a page image is not a strip under a
 * table row — so the panel's action opens it. One row is open at a time, and
 * the checkbox and the action buttons stop their own clicks.
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
  /*
   * Ask the mail room to open a sealed envelope and scan what is inside. Raised
   * to the page rather than fired here, because it is the same mutation the item
   * viewer submits and both must invalidate the same queries.
   */
  onRequestScan?: (itemId: string) => void;
  // The item whose scan request is in flight, so only its own button waits.
  scanningItemId?: string | null;
  /*
   * What "nothing here" means for the view being shown. The same list serves the
   * room's three tabs, and an empty Requests tab is good news where an empty
   * Inbox is not — one sentence cannot be right for both.
   */
  empty?: { title: string; body: string };
};

function itemHref(roomId: string, itemId: string) {
  return `/app/mailroom/${roomId}/${itemId}`;
}

/*
 * A row's actions. Usually one; a sealed envelope has two, because looking at
 * the envelope and asking us to open it are different things and the customer
 * may want either first.
 *
 * "Respond" is only for an item WE need something on. Once the customer has
 * submitted a request the item is still `action_requested`, but the ball is in
 * our court — there is nothing to respond to, and the backend would reject a
 * second request as a conflict. So an item with an open request keeps the plain
 * "View" action.
 */
function RowAction({
  item,
  roomId,
  fullWidth,
  onRequestScan,
  isScanning = false,
}: {
  item: MailItem;
  roomId: string;
  fullWidth?: boolean;
  onRequestScan?: (itemId: string) => void;
  isScanning?: boolean;
}) {
  const width = fullWidth ? 'w-full' : 'w-full lg:w-auto lg:min-w-[5rem]';
  const base = `inline-flex items-center justify-center gap-1.5 rounded-[0.5rem] px-4 py-2 text-[0.8125rem] font-semibold transition-colors lg:rounded-[0.625rem] ${width}`;
  const primary = `${base} bg-primary text-white hover:bg-primary-hover`;
  const secondary = `${base} border border-primary bg-white text-primary hover:bg-primary-light`;

  const view = (className: string, label = 'View') => (
    <Link to={itemHref(roomId, item.id)} className={className}>
      {label}
    </Link>
  );

  /*
   * A sealed envelope nobody has been asked to open: the useful action is asking
   * us to open it, with viewing the envelope beside it.
   *
   * Post that has already been forwarded or shredded is excluded even though it
   * is technically still unopened — it is not in the building any more, and the
   * backend refuses the request. Offering a button that can only fail is worse
   * than not offering it.
   */
  const handled = item.status === 'forwarded' || item.status === 'archived';

  if (!item.scanReady && !item.hasOpenRequest && !handled && onRequestScan) {
    return (
      <div
        className={`flex gap-2 ${fullWidth ? 'w-full' : 'w-full lg:w-auto lg:justify-end'}`}
      >
        <button
          type="button"
          onClick={() => onRequestScan(item.id)}
          disabled={isScanning}
          className={`${primary} disabled:cursor-default disabled:bg-gray-300 disabled:hover:bg-gray-300`}
        >
          <ScanLine className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          {isScanning ? 'Sending…' : 'Scan'}
        </button>
        {view(secondary)}
      </div>
    );
  }

  if (item.status === 'action_requested' && !item.hasOpenRequest) {
    return view(primary, 'Respond');
  }

  return view(secondary);
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
        <AlertTriangle
          className="size-3.5 shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}

const DEFAULT_EMPTY = {
  title: 'No mail here yet',
  body: 'Nothing matches this view. Try another status, clear your search, or check back once new mail arrives.',
};

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <Inbox
          className="size-6 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <p className="text-body-lg font-semibold text-text">{title}</p>
      <p className="max-w-[22.5rem] text-body text-gray-500">{body}</p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-card" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-12 w-full animate-pulse rounded-input bg-gray-200"
        />
      ))}
    </div>
  );
}

export function MailList({
  items,
  roomId,
  page,
  pageSize,
  totalItems,
  isLoading,
  onRequestScan,
  scanningItemId = null,
  empty = DEFAULT_EMPTY,
}: MailListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { expandedId, toggle: toggleExpanded } = useExpandedRow();

  const isEmpty = !isLoading && items.length === 0;
  const showSkeleton = Boolean(isLoading) && items.length === 0;

  // Desktop/tablet show one page window into the loaded set; mobile shows all.
  const windowStart = (page - 1) * pageSize;
  const windowItems = useMemo(
    () => items.slice(windowStart, windowStart + pageSize),
    [items, windowStart, pageSize],
  );

  const windowIds = windowItems.map((item) => item.id);
  const allSelected =
    windowIds.length > 0 && windowIds.every((id) => selected.has(id));

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
            <EmptyState title={empty.title} body={empty.body} />
          </div>
        ) : (
          items.map((item) => {
            const soon = isStorageExpiringSoon(item.storageExpiresAt);
            const isExpanded = item.id === expandedId;
            const panelId = detailPanelId('mail-card', item.id);

            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.id)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  className="flex gap-3 rounded-input text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span
                    className="h-[3.25rem] w-10 shrink-0 rounded-lg bg-gray-200"
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-body font-semibold text-text">
                        {item.sender}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <MailStatusChip status={item.status} />
                        <ExpandChevron isExpanded={isExpanded} />
                      </span>
                    </span>
                    <span className="block text-small text-gray-500">
                      Received {formatOrderDate(item.receivedAt)}
                    </span>
                    {soon ? (
                      <span
                        className={`flex items-center gap-1 text-small font-semibold ${AMBER}`}
                      >
                        <AlertTriangle
                          className="size-3 shrink-0"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        Expires {formatOrderDate(item.storageExpiresAt)}
                      </span>
                    ) : (
                      <span className="block text-small text-gray-400">
                        Expires {formatOrderDate(item.storageExpiresAt)}
                      </span>
                    )}
                  </span>
                </button>

                {isExpanded ? (
                  <div id={panelId} onClick={stopRowToggle}>
                    <MailItemDetails
                      item={item}
                      roomId={roomId}
                      to={itemHref(roomId, item.id)}
                    />
                  </div>
                ) : null}

                {/* Mobile has no preview thumbnail to carry the stage, so the
                    one piece of mail that is waiting on US says so in words. */}
                {item.openRequestType === 'scan' ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-primary-light p-2">
                    <ScanLine
                      className="size-3.5 shrink-0 text-primary"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="text-caption font-medium text-primary">
                      We&apos;re opening and scanning this envelope
                    </span>
                  </div>
                ) : null}

                {item.status === 'action_requested' &&
                item.responseDueAt &&
                !item.hasOpenRequest ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-[var(--color-status-review-bg)] p-2">
                    <AlertTriangle
                      className={`size-3.5 shrink-0 ${AMBER}`}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className={`text-caption font-medium ${AMBER}`}>
                      Response needed by {formatOrderDate(item.responseDueAt)}
                    </span>
                  </div>
                ) : null}

                <div className="h-px w-full bg-gray-200" />
                <RowAction
                  item={item}
                  roomId={roomId}
                  fullWidth
                  onRequestScan={onRequestScan}
                  isScanning={scanningItemId === item.id}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Tablet & desktop — card-wrapped table */}
      <div className="hidden w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
        <div className="table-scroll">
          <table className="data-table min-w-[41rem] table-fixed lg:min-w-[58rem]">
            <thead>
              <tr className="h-12">
                <th scope="col" className="w-[2.75rem] pl-4 lg:pl-6">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all mail on this page"
                    disabled={windowIds.length === 0}
                    className="size-[1.125rem] cursor-pointer rounded-[0.25rem] accent-primary"
                  />
                </th>
                <th scope="col" className="w-[3.25rem] lg:w-[5rem]">
                  Preview
                </th>
                <th scope="col" className="pr-3">
                  Sender
                </th>
                <th
                  scope="col"
                  className="hidden w-[8.75rem] pr-3 lg:table-cell"
                >
                  Received
                </th>
                <th scope="col" className="w-[7.75rem] pr-3 lg:w-[11.25rem]">
                  <span className="inline-flex items-center gap-1">
                    Storage expires
                    <StorageExpiryInfo />
                  </span>
                </th>
                <th scope="col" className="w-[7.75rem] pr-3 lg:w-[10rem]">
                  Status
                </th>
                {/* Wider than the other links draw it: a sealed envelope
                    carries two actions, Scan and View, rather than one. */}
                <th
                  scope="col"
                  className="w-[7.5rem] pr-3 text-right lg:w-[11.5rem]"
                >
                  Action
                </th>
                <th scope="col" className="w-[4rem] pr-4 lg:pr-6">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>

            {!showSkeleton && !isEmpty && (
              <tbody>
                {windowItems.map((item) => {
                  const isSelected = selected.has(item.id);
                  const isExpanded = item.id === expandedId;
                  const panelId = detailPanelId('mail', item.id);

                  return (
                    <Fragment key={item.id}>
                    <tr
                      {...expandRowProps({
                        isExpanded,
                        panelId,
                        onToggle: () => toggleExpanded(item.id),
                        label: `${isExpanded ? 'Hide' : 'Show'} details for mail from ${item.sender}`,
                      })}
                      className={`h-16 lg:h-[4.5rem] ${
                        isSelected
                          ? 'cursor-pointer bg-primary-light transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'
                          : expandedRowClass(isExpanded)
                      }`}
                    >
                      <td className="pl-4 lg:pl-6" onClick={stopRowToggle}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(item.id)}
                          aria-label={`Select mail from ${item.sender}`}
                          className="size-[1.125rem] cursor-pointer rounded-[0.25rem] accent-primary"
                        />
                      </td>

                      <td>
                        <ScanThumbnail
                          ready={item.scanReady}
                          scanRequested={item.openRequestType === 'scan'}
                        />
                      </td>

                      <td className="min-w-0 pr-3">
                        <p
                          className="truncate font-semibold"
                          title={item.sender}
                        >
                          {item.sender}
                        </p>
                        {item.note ? (
                          <p
                            className={`truncate text-small font-medium ${AMBER}`}
                          >
                            {item.note}
                          </p>
                        ) : null}
                        <p className="truncate text-small text-gray-500 lg:hidden">
                          Received: {formatOrderDate(item.receivedAt)}
                        </p>
                      </td>

                      <td className="hidden whitespace-nowrap pr-3 text-gray-600 lg:table-cell">
                        {formatOrderDate(item.receivedAt)}
                      </td>

                      <td className="pr-3">
                        <ExpiresValue iso={item.storageExpiresAt} />
                      </td>

                      <td className="pr-3">
                        <MailStatusChip status={item.status} />
                      </td>

                      <td
                        className="pr-3 text-right"
                        onClick={stopRowToggle}
                      >
                        <div className="flex justify-end">
                          <RowAction
                            item={item}
                            roomId={roomId}
                            onRequestScan={onRequestScan}
                            isScanning={scanningItemId === item.id}
                          />
                        </div>
                      </td>

                      <ExpandChevronCell isExpanded={isExpanded} />
                    </tr>

                    {isExpanded ? (
                      <DetailRow panelId={panelId} colSpan={8}>
                        <MailItemDetails
                          item={item}
                          roomId={roomId}
                          to={itemHref(roomId, item.id)}
                        />
                      </DetailRow>
                    ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>

        {showSkeleton && <SkeletonRows />}
        {isEmpty && <EmptyState title={empty.title} body={empty.body} />}
      </div>
    </section>
  );
}
