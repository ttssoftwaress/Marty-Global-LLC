import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  ResultList,
  ResultListControls,
  useServiceResults,
  type ResultStatusFilter,
} from '../features/my-services';
import { serviceIcon } from '../features/order-new-service/serviceIcons';
import { usePortalShell } from '../hooks/usePortalShell';

/*
 * A service's delivered records — "My companies", "My registrations", whatever
 * the admin named this service's page.
 *
 * One screen serves every service. The heading, the noun, the table's columns
 * and the empty-state copy all arrive with the data, so a new service with a
 * result schema gets a working page the moment its first record is delivered —
 * no route, no component, no deploy.
 *
 * One tree serves all three viewports; `ResultList` owns the table ⇄ card
 * reshape, the same split the mail and orders lists use.
 */

function RecordsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center shadow-sm-elevation"
    >
      <span className="flex size-12 items-center justify-center rounded-[24px] bg-[var(--color-status-missing-bg)]">
        <AlertTriangle className="size-6 text-error" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">We couldn&apos;t load this page</p>
      <p className="max-w-[360px] text-body text-gray-500">
        Something went wrong fetching your records. Please try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="btn btn-secondary mt-1 h-11 rounded-input px-5 text-body"
      >
        Try again
      </button>
    </div>
  );
}

function RecordsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6" aria-hidden="true">
      <div className="h-11 w-full animate-pulse rounded-input bg-gray-200 md:w-[320px]" />
      <div className="h-[320px] w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

export function ServiceRecordsPage() {
  const { user, onLogout } = usePortalShell();
  const { slug = '' } = useParams<{ slug: string }>();

  const [status, setStatus] = useState<ResultStatusFilter>('all');
  const [search, setSearch] = useState('');

  const query = useServiceResults({ slug, status, search });

  // The cursor stream flattened into one list — mobile appends, and the table
  // renders whatever has loaded.
  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.rows) ?? [],
    [query.data],
  );

  // Every page carries the same service header and columns; the first is enough.
  const first = query.data?.pages[0];
  const service = first?.service;
  const Icon = service ? serviceIcon(service.iconKey) : null;

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 lg:gap-8">
          <header className="flex w-full flex-col gap-1 md:gap-3">
            <p className="flex items-center gap-1.5 text-caption font-medium uppercase tracking-[0.6px]">
              <Link to="/app" className="text-primary hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-500">{service?.pageTitle ?? 'My services'}</span>
            </p>

            <div className="flex flex-col gap-1 md:gap-1.5">
              <h1 className="flex items-center gap-2.5 text-h4 font-semibold text-text md:text-h3">
                {Icon ? (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-light md:size-10">
                    <Icon className="size-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                ) : null}
                {service?.pageTitle ?? 'My services'}
              </h1>
              <p className="text-body text-text-secondary">
                {service
                  ? `Everything we've delivered for your ${service.name} orders.`
                  : 'Your delivered services.'}
              </p>
            </div>
          </header>

          {query.isLoading ? (
            <RecordsSkeleton />
          ) : query.isError || !service || !first ? (
            <RecordsError onRetry={() => void query.refetch()} />
          ) : (
            <>
              <ResultListControls
                status={status}
                onStatusChange={setStatus}
                search={search}
                onSearchChange={setSearch}
                noun={service.noun}
                totalResults={first.totalResults}
              />

              <ResultList
                service={service}
                columns={first.columns}
                rows={rows}
                isLoading={query.isFetching && rows.length === 0}
                hasFilter={status !== 'all' || search.trim().length > 0}
              />

              {query.hasNextPage ? (
                <button
                  type="button"
                  onClick={() => void query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                  className="btn btn-secondary mx-auto inline-flex h-11 items-center gap-2 rounded-input px-6 text-body disabled:opacity-60"
                >
                  {query.isFetchingNextPage ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                  ) : null}
                  Load more
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
