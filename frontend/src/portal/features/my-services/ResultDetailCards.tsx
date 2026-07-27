import { AlertTriangle, CheckCircle2, Clock, Plus, Sparkles, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { formatOrderDate, formatRelativeTime } from '../../lib/format';
import type {
  RequestType,
  ResultField,
  ResultValue,
  ServiceRequestStatus,
  ServiceRequestSummary,
} from '../../types/my-services';
import { ResultValueView } from './ResultValueView';

/*
 * The cards on a record's detail page: its facts, the actions available against
 * it, and the requests already raised.
 *
 * The fact cards are entirely data-driven — the backend groups the schema by the
 * admin's `category` and this renders one card per group, so a service whose
 * schema names three categories gets three cards with no change here.
 */

export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-card">
      <h2 className="text-body-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

/*
 * One section's facts.
 *
 * Label above value on mobile, two columns from tablet up — a label/value pair
 * squeezed side by side on a narrow screen truncates the value, which is the one
 * thing the customer actually came to read. `textarea` and `file` take the full
 * width in both, since neither fits a half column.
 */
export function ResultFieldGrid({
  fields,
  values,
  downloads,
}: {
  fields: ResultField[];
  values: Record<string, ResultValue>;
  downloads: Record<string, string>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-5">
      {fields.map((field) => {
        const fullWidth = field.type === 'textarea' || field.type === 'file';

        return (
          <div
            key={field.name}
            className={`flex flex-col gap-1 ${fullWidth ? 'md:col-span-2' : ''}`}
          >
            <dt className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
              {field.label}
            </dt>
            <dd className="min-w-0">
              <ResultValueView
                field={field}
                value={values[field.name]}
                downloadUrl={downloads[field.name]}
              />
              {field.hint ? (
                <p className="mt-1 text-caption text-gray-500">{field.hint}</p>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/*
 * The admin-defined actions, one button each.
 *
 * Every button is a `ServiceRequestType` the admin registered against this
 * service — the customer's whole self-service surface for a delivered record,
 * and adding one is a catalog change rather than a deploy.
 */
export function RequestActionsCard({
  requestTypes,
  onSelect,
  disabled,
  disabledReason,
}: {
  requestTypes: RequestType[];
  onSelect: (requestType: RequestType) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  if (requestTypes.length === 0) return null;

  return (
    <SectionCard title="What would you like to do?">
      {disabled && disabledReason ? (
        <p className="text-body text-gray-500">{disabledReason}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {requestTypes.map((requestType) => (
          <button
            key={requestType.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(requestType)}
            className="flex items-start gap-3 rounded-input border border-gray-200 bg-white p-4 text-left transition-colors hover:border-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-light">
              {/*
               * The catalog names an icon intent; this app owns the glyph
               * (Design.md — icons are pulled from the library, never exported).
               * Every request type shares one until the catalog's intents grow a
               * map of their own.
               */}
              <Plus className="size-[18px] text-primary" strokeWidth={2} aria-hidden="true" />
            </span>

            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body font-semibold text-text">{requestType.label}</span>
              {requestType.description ? (
                <span className="text-caption text-gray-500">{requestType.description}</span>
              ) : null}
              {requestType.turnaround ? (
                <span className="text-caption text-gray-400">{requestType.turnaround}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

/*
 * A request's state, as the customer reads it.
 *
 * `blocked` deliberately reads as "needs your attention" rather than as an
 * error: the reason is almost always something we need FROM the customer, and
 * "Error" would tell them something broke when what happened is that we are
 * waiting on them.
 */
const REQUEST_STATUS_VIEW: Record<
  ServiceRequestStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  submitted: {
    label: 'Submitted',
    icon: Clock,
    className:
      'bg-[var(--color-status-review-bg)] text-[color:var(--color-status-review-text)]',
  },
  in_progress: {
    label: 'In progress',
    icon: Sparkles,
    className: 'bg-primary-light text-primary',
  },
  blocked: {
    label: 'Needs attention',
    icon: AlertTriangle,
    className:
      'bg-[var(--color-status-missing-bg)] text-[color:var(--color-status-missing-text)]',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className:
      'bg-[var(--color-status-completed-bg)] text-[color:var(--color-status-completed-text)]',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-gray-100 text-gray-500',
  },
};

export function RequestStatusChip({ status }: { status: ServiceRequestStatus }) {
  const view = REQUEST_STATUS_VIEW[status];
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

export function RequestHistoryCard({
  requests,
}: {
  requests: ServiceRequestSummary[];
}) {
  if (requests.length === 0) return null;

  return (
    <SectionCard title="Your requests">
      <ul className="flex flex-col divide-y divide-gray-100">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-medium text-text">
                  {request.typeLabel}
                </span>
                <span className="text-caption text-gray-500">
                  {request.reference} · {formatRelativeTime(request.createdAt)}
                </span>
              </span>
              <RequestStatusChip status={request.status} />
            </div>

            {request.note ? (
              <p className="text-body text-gray-600">{request.note}</p>
            ) : null}

            {/* The reason a blocked request cannot proceed is the whole content
             * of that state — without it the customer sees a stalled request and
             * no way to unstick it. */}
            {request.status === 'blocked' && request.blockedReason ? (
              <p className="rounded-input bg-[var(--color-status-missing-bg)] px-3 py-2 text-body text-[color:var(--color-status-missing-text)]">
                {request.blockedReason}
              </p>
            ) : null}

            {request.status === 'completed' && request.resolution ? (
              <p className="rounded-input bg-gray-50 px-3 py-2 text-body text-gray-600">
                {request.resolution}
              </p>
            ) : null}

            {request.closedAt ? (
              <p className="text-caption text-gray-400">
                Closed {formatOrderDate(request.closedAt)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
