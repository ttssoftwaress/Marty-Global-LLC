import { useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '@/services/api';
import { AdminLayout } from '../components/AdminLayout';
import {
  RequestStatusChip,
  ResultForm,
  useAdminRequest,
  useAdminRequestResult,
  useSaveAdminRequestResult,
  useUpdateAdminRequest,
} from '../features/delivery';
import { OrderConversationCard } from '../features/order-conversation';
import { SectionCard } from '../features/order-detail/SectionCard';
import { useAdminShell } from '../hooks/useAdminShell';
import { formatActivityTime, formatOrderDate } from '../lib/format';
import { REQUEST_STATUS_OPTIONS, type ServiceRequestStatus } from '../types/delivery';

/*
 * One follow-up request — the screen staff work it on.
 *
 * It answers three things in order: what the customer asked for, what state the
 * request is in, and what needs changing on the record because of it. That last
 * one is why the result form is on this page at all: a request is almost always
 * "change this one fact", and sending the operator to the order screen to do it
 * would lose the context they are working from.
 *
 * The conversation is the ORDER's thread, not a new one. The customer is already
 * talking to the person handling their filing, and a second inbox per request
 * would fragment that into a dozen threads about the same company.
 *
 * Layout follows the order-detail screen: a main column beside a 380px rail on
 * desktop, collapsing to one column with the controls lifted above the detail on
 * tablet and mobile — an operator on a phone is here to act.
 */

function RequestSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5" aria-hidden="true">
      <div className="h-24 w-full animate-pulse rounded-card bg-gray-200" />
      <div className="h-[20rem] w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-16 text-center shadow-sm-elevation">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-[var(--color-status-missing-bg)]">
        <AlertTriangle className="size-6 text-error" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">We couldn&apos;t open this request</p>
      <p className="max-w-[23.75rem] text-body text-gray-500">
        It may have been reassigned, or you may not have access to it.
      </p>
      <Link to="/admin/requests" className="btn btn-primary mt-1 h-11 rounded-input px-5 text-body">
        Back to the queue
      </Link>
    </div>
  );
}

export function AdminRequestDetailPage() {
  const shell = useAdminShell();
  const { requestId = '' } = useParams<{ requestId: string }>();

  const request = useAdminRequest(requestId);
  const update = useUpdateAdminRequest(requestId);

  const [showResult, setShowResult] = useState(false);
  const result = useAdminRequestResult(requestId, showResult);
  const saveResult = useSaveAdminRequestResult(requestId);

  const [blockedReason, setBlockedReason] = useState('');
  const [resolution, setResolution] = useState('');
  const [note, setNote] = useState('');
  const [internal, setInternal] = useState(false);

  const data = request.data;

  const changeStatus = (status: ServiceRequestStatus) => {
    // BLOCKED must carry a reason — it is what the customer is shown in place of
    // progress, and the backend rejects it without one (422). Prompting here
    // saves a round trip; the endpoint is still the rule.
    if (status === 'blocked' && !blockedReason.trim()) return;

    update.mutate({
      status,
      ...(status === 'blocked' ? { blockedReason: blockedReason.trim() } : {}),
      ...(status === 'completed' && resolution.trim()
        ? { resolution: resolution.trim() }
        : {}),
    });
  };

  const error =
    update.error instanceof ApiError
      ? update.error.message
      : update.isError
        ? 'Something went wrong updating this request.'
        : null;

  return (
    <AdminLayout {...shell}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5 md:gap-6">
          <p className="flex flex-wrap items-center gap-1.5 text-caption font-medium uppercase tracking-[0.6px]">
            <Link to="/admin" className="text-primary hover:underline">
              Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <Link to="/admin/requests" className="text-primary hover:underline">
              Service requests
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500">{data?.reference ?? 'Request'}</span>
          </p>

          {request.isPending ? (
            <RequestSkeleton />
          ) : !data ? (
            <NotFound />
          ) : (
            <>
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h1 className="text-h4 font-semibold text-text md:text-h3">
                    {data.typeLabel}
                  </h1>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-text-secondary">
                    <span>{data.reference}</span>
                    <span className="text-gray-300" aria-hidden="true">
                      ·
                    </span>
                    <span>{data.serviceName}</span>
                    <span className="text-gray-300" aria-hidden="true">
                      ·
                    </span>
                    <span>Raised {formatActivityTime(data.createdAt)}</span>
                  </p>
                </div>

                <RequestStatusChip status={data.status} />
              </header>

              <div className="flex flex-col gap-5 md:gap-6 lg:flex-row lg:items-start">
                {/* Main column — what was asked, and the record it concerns. */}
                <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-6">
                  <div className="order-2">
                    <SectionCard title="What the customer asked for" className="gap-4">
                      {data.note ? (
                        <p className="whitespace-pre-line break-words text-body text-text">
                          {data.note}
                        </p>
                      ) : (
                        <p className="text-body text-gray-400">
                          No note was added to this request.
                        </p>
                      )}

                      {data.answers.length > 0 ? (
                        <dl className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                          {data.answers.map((answer) => (
                            <div
                              key={answer.label}
                              className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-4"
                            >
                              <dt className="text-body font-medium text-gray-500 md:w-[12.5rem] md:shrink-0">
                                {answer.label}
                              </dt>
                              <dd className="min-w-0 break-words text-body text-text">
                                {answer.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </SectionCard>
                  </div>

                  {/* The delivered record this request is about, editable in
                   * place — the whole reason an operator does not have to leave
                   * this screen to act on the ask. */}
                  <div className="order-3">
                    <SectionCard title="The customer's record" className="gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <p className="text-body font-semibold text-text">
                            {data.resultTitle}
                          </p>
                          <Link
                            to={`/admin/orders/${data.orderId}`}
                            className="inline-flex items-center gap-1.5 text-caption text-primary hover:underline"
                          >
                            {data.orderReference}
                            <ExternalLink className="size-3" strokeWidth={2} aria-hidden="true" />
                          </Link>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowResult((current) => !current)}
                          aria-expanded={showResult}
                          className="btn btn-secondary h-10 rounded-input px-4 text-body"
                        >
                          {showResult ? 'Hide record' : 'Edit record'}
                        </button>
                      </div>

                      {showResult ? (
                        <div className="border-t border-gray-100 pt-4">
                          {result.isLoading ? (
                            <div className="flex items-center gap-2 py-6 text-body text-gray-500">
                              <Loader2
                                className="size-4 animate-spin"
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                              Loading the record…
                            </div>
                          ) : result.isError || !result.data?.result ? (
                            <p role="alert" className="py-4 text-body text-error">
                              We couldn&apos;t load this record. You may not have
                              access to the order behind it.
                            </p>
                          ) : (
                            /*
                             * `amend` mode: the record is already live, so saving
                             * IS publishing and a "Save draft" button would imply
                             * the customer wouldn't see it.
                             */
                            <ResultForm
                              mode="amend"
                              result={result.data.result}
                              isSaving={saveResult.isPending}
                              error={saveResult.error}
                              onSave={(values, deliver) =>
                                saveResult.mutate({ values, deliver })
                              }
                            />
                          )}
                        </div>
                      ) : null}
                    </SectionCard>
                  </div>

                  <div className="order-4">
                    <SectionCard title="History" className="gap-3">
                      {data.activity.length === 0 ? (
                        <p className="text-body text-gray-400">Nothing yet.</p>
                      ) : (
                        <ul className="flex flex-col divide-y divide-gray-100">
                          {data.activity.map((entry) => (
                            <li
                              key={entry.id}
                              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-body font-medium text-text">
                                  {entry.authorName}
                                </span>
                                {entry.internal ? (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-caption font-medium text-gray-500">
                                    Internal
                                  </span>
                                ) : null}
                                <span className="ml-auto text-caption text-gray-500">
                                  {formatActivityTime(entry.occurredAt)}
                                </span>
                              </div>
                              <p className="whitespace-pre-line break-words text-body text-text-secondary">
                                {entry.message}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </SectionCard>
                  </div>

                  {data.conversationId ? (
                    <div className="order-5">
                      <OrderConversationCard orderId={data.orderId} />
                    </div>
                  ) : null}
                </div>

                {/* Rail — what the operator does about it. */}
                <div className="contents lg:flex lg:w-[23.75rem] lg:shrink-0 lg:flex-col lg:gap-6">
                  <div className="order-1">
                    <SectionCard title="Work this request" className="gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="request-status"
                          className="text-body font-medium text-text"
                        >
                          Status
                        </label>
                        <select
                          id="request-status"
                          value={data.status}
                          disabled={update.isPending}
                          onChange={(event) =>
                            changeStatus(event.target.value as ServiceRequestStatus)
                          }
                          className="h-11 w-full rounded-input border border-gray-200 bg-white px-3 text-body text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                        >
                          {REQUEST_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* The reason is required to block, so the field is offered
                       * before the status is chosen rather than after it fails. */}
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="blocked-reason"
                          className="text-body font-medium text-text"
                        >
                          Reason, if blocking
                        </label>
                        <textarea
                          id="blocked-reason"
                          rows={2}
                          value={blockedReason || data.blockedReason || ''}
                          onChange={(event) => setBlockedReason(event.target.value)}
                          placeholder="What the customer needs to do"
                          className="w-full rounded-input border border-gray-200 bg-white px-3 py-2.5 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="text-caption text-gray-500">
                          Shown to the customer in place of progress.
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="resolution"
                          className="text-body font-medium text-text"
                        >
                          Closing note, if completing
                        </label>
                        <textarea
                          id="resolution"
                          rows={2}
                          value={resolution || data.resolution || ''}
                          onChange={(event) => setResolution(event.target.value)}
                          placeholder="What was done"
                          className="w-full rounded-input border border-gray-200 bg-white px-3 py-2.5 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
                        <label htmlFor="note" className="text-body font-medium text-text">
                          Add a note
                        </label>
                        <textarea
                          id="note"
                          rows={2}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          className="w-full rounded-input border border-gray-200 bg-white px-3 py-2.5 text-body text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <label className="flex items-center gap-2 text-body text-gray-600">
                          <input
                            type="checkbox"
                            checked={internal}
                            onChange={(event) => setInternal(event.target.checked)}
                            className="size-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          Internal only — the customer never sees this
                        </label>

                        <button
                          type="button"
                          disabled={!note.trim() || update.isPending}
                          onClick={() =>
                            update.mutate(
                              { note: note.trim(), internal },
                              { onSuccess: () => setNote('') },
                            )
                          }
                          className="btn btn-secondary h-10 rounded-input px-4 text-body disabled:opacity-60"
                        >
                          Add note
                        </button>
                      </div>

                      {error ? (
                        <p role="alert" className="text-body text-error">
                          {error}
                        </p>
                      ) : null}
                    </SectionCard>
                  </div>

                  <div className="order-6">
                    <SectionCard title="Details" className="gap-3">
                      <dl className="flex flex-col gap-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-body text-gray-500">Customer</dt>
                          <dd className="text-body text-text">{data.customer.name}</dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-body text-gray-500">Assignee</dt>
                          <dd className="text-body text-text">
                            {data.assignee?.name ?? 'Unassigned'}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-body text-gray-500">Raised</dt>
                          <dd className="text-body text-text">
                            {formatOrderDate(data.createdAt)}
                          </dd>
                        </div>
                        {data.closedAt ? (
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-body text-gray-500">Closed</dt>
                            <dd className="text-body text-text">
                              {formatOrderDate(data.closedAt)}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </SectionCard>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
