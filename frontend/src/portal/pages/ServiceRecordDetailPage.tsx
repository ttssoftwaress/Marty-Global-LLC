import { useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  RequestActionsCard,
  RequestDialog,
  RequestHistoryCard,
  ResultFieldGrid,
  SectionCard,
  useServiceResult,
} from '../features/my-services';
import { OrderConversationSection } from '../features/order-conversation';
import { formatOrderDate } from '../lib/format';
import type { RequestType } from '../types/my-services';
import { usePortalShell } from '../hooks/usePortalShell';

/*
 * One delivered record — the company, the registration, whatever this service
 * returns.
 *
 * Three things stacked, in the order the customer needs them:
 *   1. the facts, grouped into the cards the admin's categories define
 *   2. the actions available against the record — the admin-defined buttons
 *   3. the requests already raised, and the order's conversation
 *
 * The conversation is the ORDER's thread, reused rather than duplicated: the
 * customer is talking to the person who did their filing, and a second inbox
 * hanging off the record would split that conversation in two.
 *
 * Like the list, none of the content is declared here — `sections` arrives
 * grouped and resolved, so this page renders whatever the service returns.
 */

function DetailError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center shadow-sm-elevation"
    >
      <span className="flex size-12 items-center justify-center rounded-[24px] bg-[var(--color-status-missing-bg)]">
        <AlertTriangle className="size-6 text-error" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">We couldn&apos;t load this record</p>
      <p className="max-w-[360px] text-body text-gray-500">
        It may have been moved, or something went wrong. Please try again.
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary h-11 rounded-input px-5 text-body"
        >
          Try again
        </button>
        <Link to="/app" className="btn btn-primary h-11 rounded-input px-5 text-body">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6" aria-hidden="true">
      <div className="h-[220px] w-full animate-pulse rounded-card bg-gray-200" />
      <div className="h-[160px] w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

export function ServiceRecordDetailPage() {
  const { user, onLogout } = usePortalShell();
  const { resultId = '' } = useParams<{ resultId: string }>();
  const [activeRequest, setActiveRequest] = useState<RequestType | null>(null);

  const query = useServiceResult(resultId);
  const record = query.data;

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 lg:gap-8">
          <header className="flex w-full flex-col gap-1 md:gap-3">
            <p className="flex flex-wrap items-center gap-1.5 text-caption font-medium uppercase tracking-[0.6px]">
              <Link to="/app" className="text-primary hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              {record ? (
                <>
                  <Link
                    to={`/app/services/${record.serviceSlug}`}
                    className="text-primary hover:underline"
                  >
                    {record.pageTitle}
                  </Link>
                  <span className="text-gray-400">/</span>
                </>
              ) : null}
              <span className="text-gray-500">{record?.reference ?? 'Record'}</span>
            </p>

            <div className="flex flex-col gap-1 md:gap-1.5">
              <h1 className="text-h4 font-semibold text-text md:text-h3">
                {record?.title ?? 'Record'}
              </h1>

              {record ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-text-secondary">
                  <span>{record.serviceName}</span>
                  <span className="text-gray-300" aria-hidden="true">
                    ·
                  </span>
                  <Link
                    to={`/app/orders/${record.orderId}`}
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <FileText className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    {record.orderReference}
                  </Link>
                  {record.deliveredAt ? (
                    <>
                      <span className="text-gray-300" aria-hidden="true">
                        ·
                      </span>
                      <span>Delivered {formatOrderDate(record.deliveredAt)}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </header>

          {query.isLoading ? (
            <DetailSkeleton />
          ) : query.isError || !record ? (
            <DetailError onRetry={() => void query.refetch()} />
          ) : (
            <>
              {record.status === 'archived' ? (
                <p className="rounded-card border border-gray-200 bg-gray-50 px-4 py-3 text-body text-gray-600">
                  This record is archived. It stays here for your reference, but no
                  new requests can be raised against it.
                </p>
              ) : null}

              {record.sections.map((section) => (
                <SectionCard key={section.title} title={section.title}>
                  <ResultFieldGrid
                    fields={section.fields}
                    values={record.values}
                    downloads={record.downloads}
                  />
                </SectionCard>
              ))}

              <RequestActionsCard
                requestTypes={record.requestTypes}
                onSelect={setActiveRequest}
                disabled={record.status === 'archived'}
                disabledReason={
                  record.status === 'archived'
                    ? 'Requests are unavailable on an archived record.'
                    : undefined
                }
              />

              <RequestHistoryCard requests={record.requests} />

              {/* The order's own thread — the same conversation the order detail
               * screen shows, not a second one. */}
              {record.conversationId ? (
                <OrderConversationSection orderId={record.orderId} />
              ) : null}

              {record.lastEditedAt ? (
                <p className="text-caption text-gray-400">
                  Last updated {formatOrderDate(record.lastEditedAt)}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {activeRequest ? (
        <RequestDialog
          resultId={resultId}
          requestType={activeRequest}
          onClose={() => setActiveRequest(null)}
        />
      ) : null}
    </PortalLayout>
  );
}
