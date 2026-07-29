import { useState } from 'react';
import { CheckCircle2, ChevronDown, Circle, Clock, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { AdminOrderItem, AdminOrderItemStatus } from '../../types/order-detail';
import {
  useOrderItemResult,
  useSaveOrderItemResult,
  useUpdateOrderItemStatus,
} from './queries';
import { ResultForm } from './ResultForm';

/*
 * One service line on an order, and how staff complete it.
 *
 * The delivery grain is the ITEM, not the order: an order groups several
 * services that do not finish together, so each line carries its own status and
 * — where the service returns something — its own result form.
 *
 * Two completion paths, and which one a line gets is the service's decision, not
 * the operator's:
 *
 *   returns a record  → the form below. Completing IS delivering, so the
 *                       required-field gate cannot be stepped around.
 *   returns nothing   → a plain status control. There is nothing to fill in.
 *
 * The form is collapsed by default. A reviewer opening an order is usually
 * reading it, not delivering it, and three expanded forms would bury the
 * answers the customer actually submitted.
 */

const STATUS_VIEW: Record<
  AdminOrderItemStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  pending: {
    label: 'Not started',
    icon: Circle,
    className: 'bg-gray-100 text-gray-500',
  },
  in_progress: {
    label: 'In progress',
    icon: Clock,
    className: 'bg-primary-light text-primary',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className:
      'bg-[var(--color-status-completed-bg)] text-[color:var(--color-status-completed-text)]',
  },
};

function ItemStatusChip({ status }: { status: AdminOrderItemStatus }) {
  const view = STATUS_VIEW[status];
  const Icon = view.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${view.className}`}
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
      {view.label}
    </span>
  );
}

type OrderItemDeliveryCardProps = {
  orderId: string;
  item: AdminOrderItem;
};

export function OrderItemDeliveryCard({ orderId, item }: OrderItemDeliveryCardProps) {
  // A delivered line opens collapsed; an unfinished one that needs a form opens
  // expanded, because that form is the work.
  const [open, setOpen] = useState(
    item.deliversResult && item.status !== 'completed',
  );

  // The form's data is fetched only once the card is open — opening it creates
  // the draft record, so fetching for a collapsed card would create drafts for
  // every service on every order anyone merely looked at.
  const result = useOrderItemResult(item.id, open && item.deliversResult);
  const save = useSaveOrderItemResult(item.id, orderId);
  const updateStatus = useUpdateOrderItemStatus(item.id, orderId);

  const delivery = result.data;

  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-body-lg font-semibold text-text">{item.serviceName}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <ItemStatusChip status={item.status} />
            {item.resultStatus === 'draft' ? (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-caption font-medium text-gray-500">
                Result drafted
              </span>
            ) : null}
            {item.resultStatus === 'archived' ? (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-caption font-medium text-gray-500">
                Record archived
              </span>
            ) : null}
          </div>
        </div>

        {item.deliversResult ? (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="btn btn-secondary inline-flex h-10 shrink-0 items-center gap-2 rounded-input px-4 text-body"
          >
            {open ? 'Hide' : item.status === 'completed' ? 'Edit result' : 'Fill in result'}
            <ChevronDown
              className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        ) : (
          /*
           * A service that returns nothing gets the plain control. COMPLETED is
           * offered here only because there is no record to deliver — the
           * backend rejects it for a result-bearing line.
           */
          <label className="flex shrink-0 items-center gap-2">
            <span className="sr-only">Status for {item.serviceName}</span>
            <select
              value={item.status}
              disabled={updateStatus.isPending}
              onChange={(event) =>
                updateStatus.mutate(
                  event.target.value as 'pending' | 'in_progress' | 'completed',
                )
              }
              className="h-10 rounded-input border border-gray-200 bg-white px-3 text-body text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="pending">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        )}
      </header>

      {/* The customer's answers for this service — what the filing was based on,
       * and what a reviewer reads before delivering anything. */}
      {item.fields.length > 0 ? (
        <dl className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 md:grid-cols-2 md:gap-x-5">
          {item.fields.map((field) => (
            <div key={field.label} className="flex flex-col gap-0.5">
              <dt className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
                {field.label}
              </dt>
              <dd className="text-body text-text">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {open && item.deliversResult ? (
        <div className="border-t border-gray-100 pt-4">
          {result.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-body text-gray-500">
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              Loading the result form…
            </div>
          ) : result.isError || !delivery?.result ? (
            <p role="alert" className="py-4 text-body text-error">
              We couldn&apos;t load the result form.{' '}
              {/* A service can lose its schema if an admin clears it, which is a
               * catalog problem rather than a failure here — say so. */}
              {delivery && !delivery.hasResultSchema
                ? 'This service has no result schema yet — add one from the service catalog.'
                : 'Please try again.'}
            </p>
          ) : (
            <ResultForm
              result={delivery.result}
              isSaving={save.isPending}
              error={save.error}
              onSave={(values, deliver) => save.mutate({ values, deliver })}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
