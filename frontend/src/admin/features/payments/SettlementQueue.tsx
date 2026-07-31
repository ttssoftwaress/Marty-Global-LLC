import { Bitcoin, Building2, CheckCircle2, Clock, XCircle } from 'lucide-react';

import { formatActivityTime, formatOrderDate } from '../../lib/format';
import type { SettlementRow } from '../../types/payments';

/*
 * The manual settlement queue — payments a person has to close.
 *
 * Every bank transfer is one, because nothing in this system reads a bank feed.
 * USDT joins the queue when an admin switches automatic verification off in
 * payment settings, and leaves it when they switch it back on; the backend
 * decides which providers are listed, so this component never filters by
 * provider itself.
 *
 * The row is built around the two questions a settler actually asks: how much,
 * and against which reference. The bank details the customer was shown ride
 * along on the row so the statement can be checked against the account the money
 * was meant to land in, without a trip to the settings screen.
 *
 * "Customer says sent" is shown but never treated as money: it is a claim that
 * moved this row to the top of the queue, and the copy keeps that distinction —
 * a settler who reads it as confirmation would be crediting an invoice on the
 * customer's word.
 *
 * Table from `md` up inside the page's card frame, cards below it, matching the
 * ledger and unattributed-transfer sections above it.
 */

const HEAD_CELL =
  'py-0 text-left text-caption font-medium uppercase tracking-[0.3px] text-gray-500';

export function SettlementStatusChip({ row }: { row: SettlementRow }) {
  if (row.status === 'settled') {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold leading-4 status-approved">
        <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        Received
      </span>
    );
  }

  if (row.status === 'closed') {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold leading-4 status-draft">
        <XCircle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        Closed
      </span>
    );
  }

  // Awaiting, in two flavours. The customer's claim is the only thing that
  // distinguishes "check the statement today" from "nothing has happened yet".
  return row.markedSentAt ? (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold leading-4 status-submitted">
      <Clock className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      Customer says sent
    </span>
  ) : (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold leading-4 status-review">
      <Clock className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      Awaiting transfer
    </span>
  );
}

function ProviderBadge({ provider }: { provider: SettlementRow['provider'] }) {
  const isWire = provider === 'wire_transfer';
  const Icon = isWire ? Building2 : Bitcoin;

  return (
    <span className="flex items-center gap-1.5 text-caption text-gray-500">
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {isWire ? 'Bank transfer' : 'USDT (TRC-20)'}
    </span>
  );
}

type QueueProps = {
  rows: SettlementRow[];
  /** Whether this member holds `payments.settle`. Server is the boundary. */
  canSettle: boolean;
  busyId: string | null;
  onSettle: (row: SettlementRow) => void;
  onReject: (row: SettlementRow) => void;
};

export function SettlementTable({
  rows,
  canSettle,
  busyId,
  onSettle,
  onReject,
}: QueueProps) {
  return (
    <div className="hidden w-full overflow-x-auto md:block">
      <table className="w-full min-w-[48rem] table-fixed border-collapse text-left lg:min-w-[62.5rem]">
        <thead>
          <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)]">
            <th
              scope="col"
              className={`${HEAD_CELL} w-[13rem] pl-4 pr-3 lg:w-[15rem] lg:pl-6 lg:pr-4`}
            >
              Customer
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[8.75rem] pr-3 lg:pr-4`}>
              Amount
            </th>
            <th scope="col" className={`${HEAD_CELL} hidden w-[11.25rem] pr-4 lg:table-cell`}>
              Send to
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[10.625rem] pr-3 lg:pr-4`}>
              Raised
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[11.25rem] pr-3 lg:pr-4`}>
              Status
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[11.875rem] pr-4 text-right lg:pr-6`}>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gray-200 transition-colors last:border-b-0 hover:bg-gray-50"
            >
              <td className="py-3 pl-4 pr-3 align-middle lg:pl-6 lg:pr-4">
                <span className="block truncate text-body font-medium text-text">
                  {row.customerName}
                </span>
                <span
                  className="mt-0.5 block truncate text-caption text-gray-500"
                  title={row.reference ?? undefined}
                >
                  {row.reference ?? row.customerEmail}
                </span>
              </td>

              <td className="py-3 pr-3 align-middle lg:pr-4">
                <span className="whitespace-nowrap text-body font-semibold text-text">
                  {row.amountDisplay}
                </span>
                <ProviderBadge provider={row.provider} />
              </td>

              <td className="hidden py-3 pr-4 align-middle lg:table-cell">
                <span className="block truncate text-body text-gray-600">
                  {row.accountLabel ?? '—'}
                </span>
              </td>

              <td className="py-3 pr-3 align-middle lg:pr-4">
                <span className="whitespace-nowrap text-body text-gray-600">
                  {formatOrderDate(row.createdAt)}
                </span>
                {row.markedSentAt ? (
                  <span className="mt-0.5 block truncate text-caption text-gray-400">
                    Sent {formatActivityTime(row.markedSentAt)}
                  </span>
                ) : null}
              </td>

              <td className="py-3 pr-3 align-middle lg:pr-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <SettlementStatusChip row={row} />
                  {row.status !== 'awaiting' && row.settledBy ? (
                    <span
                      className="block truncate text-caption text-gray-500"
                      title={row.settlementNote ?? undefined}
                    >
                      {row.settledBy}
                      {row.settledAt ? ` · ${formatOrderDate(row.settledAt)}` : ''}
                    </span>
                  ) : null}
                </div>
              </td>

              <td className="py-3 pr-4 text-right align-middle lg:pr-6">
                {row.status !== 'awaiting' || !canSettle ? (
                  <span aria-hidden="true" className="text-body text-gray-300">
                    —
                  </span>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onSettle(row)}
                      disabled={busyId === row.id}
                      className="rounded-control bg-primary px-3 py-1.5 text-small font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark received
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(row)}
                      disabled={busyId === row.id}
                      className="rounded-control border border-gray-300 px-3 py-1.5 text-small font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Close
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Mobile — cards on the page background, matching the ledger's mobile shape.
export function SettlementCardList({
  rows,
  canSettle,
  busyId,
  onSettle,
  onReject,
}: QueueProps) {
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body font-medium text-text">
                {row.customerName}
              </span>
              <span className="truncate text-caption text-gray-500">
                {row.reference ?? row.customerEmail}
              </span>
            </div>
            <SettlementStatusChip row={row} />
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-h6 font-semibold text-text">
                {row.amountDisplay}
              </span>
              <ProviderBadge provider={row.provider} />
            </div>

            <div className="flex flex-col items-end gap-0.5 text-right">
              {row.accountLabel ? (
                <span className="truncate text-caption text-gray-500">
                  {row.accountLabel}
                </span>
              ) : null}
              <span className="text-caption text-gray-400">
                {formatOrderDate(row.createdAt)}
              </span>
            </div>
          </div>

          {row.status === 'awaiting' && canSettle ? (
            <div className="flex items-center gap-2 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => onSettle(row)}
                disabled={busyId === row.id}
                className="flex h-10 flex-1 items-center justify-center rounded-control bg-primary text-body font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark received
              </button>
              <button
                type="button"
                onClick={() => onReject(row)}
                disabled={busyId === row.id}
                className="flex h-10 shrink-0 items-center justify-center rounded-control border border-gray-300 px-4 text-body font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
            </div>
          ) : row.settledBy ? (
            <p className="border-t border-gray-200 pt-3 text-caption text-gray-500">
              {row.settledBy}
              {row.settledAt ? ` · ${formatOrderDate(row.settledAt)}` : ''}
              {row.settlementNote ? ` — ${row.settlementNote}` : ''}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
