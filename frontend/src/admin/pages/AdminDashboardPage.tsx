import { useState } from 'react';

import { AdminLayout } from '../components/AdminLayout';
import { DataErrorState } from '../components/DataErrorState';
import {
  KpiCards,
  NeedsAttention,
  OrdersByStatus,
  PeriodFilter,
  RecentActivity,
  useAdminDashboardSummary,
} from '../features/dashboard';
import { useAdminShell } from '../hooks/useAdminShell';
import type {
  AdminDashboardSummary,
  DashboardPeriod,
} from '../types/dashboard';

/*
 * Admin dashboard — the staff home screen.
 *
 * The section order is the same at every width — header, KPIs, orders by
 * status, then activity and the attention queue — so one tree covers all three
 * links. Below `lg` the last pair is a plain column; at `lg` it becomes a row
 * with activity taking the remaining width and the attention queue a 348px
 * rail, which is what the desktop link shows.
 *
 * Every figure comes from `summary`; nothing on this page is hardcoded business
 * data. It loads from `GET /v1/admin/dashboard/summary?period=`, which the
 * backend composes from the orders, billing, customers, support, and mail-room
 * modules so each number agrees with the page it links to. A skeleton renders
 * until that query resolves.
 *
 * The props are an override for rendering the page with a supplied summary
 * (stories/tests); the route passes none and the query supplies it.
 */

type AdminDashboardPageProps = {
  summary?: AdminDashboardSummary;
  isLoading?: boolean;
};

function DashboardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 lg:gap-8" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-[7.5rem] animate-pulse rounded-card bg-gray-200"
          />
        ))}
      </div>

      <div className="h-[11.25rem] w-full animate-pulse rounded-card bg-gray-200" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="h-[26.25rem] min-w-0 flex-1 animate-pulse rounded-card bg-gray-200" />
        <div className="h-[26.25rem] animate-pulse rounded-card bg-gray-200 lg:w-[21.75rem] lg:shrink-0" />
      </div>
    </div>
  );
}

export function AdminDashboardPage(props: AdminDashboardPageProps = {}) {
  // The shell's name and role come from the auth session; the summary supplies
  // every figure on the page.
  const { user, onLogout } = useAdminShell();
  const [period, setPeriod] = useState<DashboardPeriod>('today');

  const query = useAdminDashboardSummary(period);

  // A supplied summary wins over the query, so the page can be rendered with
  // fixture data without the network.
  const summary = props.summary ?? query.data;
  const isLoading = props.summary ? Boolean(props.isLoading) : query.isPending;

  /*
   * The failure state, derived from the query's own flag (Design.md). Rendering
   * the skeleton whenever the summary is absent is what made a failed fetch
   * indistinguishable from a slow one: `isPending` goes false, no data arrives,
   * and the page animates a placeholder forever with no way out.
   */
  const isError = !props.summary && query.isError;

  /*
   * Whether this actor is reading their own filings or the whole org. The
   * backend decides it — this screen carries no permission of its own, so
   * scoping is its only access control — and the header prints the answer rather
   * than inferring it from a role. Absent a summary there is no claim to make,
   * so the header falls back to the org-wide copy it already reads as.
   */
  const isScoped = summary?.scope === 'assigned';

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[87.5rem] flex-col gap-6 lg:gap-8">
          {/*
           * Desktop puts the title block and the period pill on one line;
           * tablet and mobile stack them, so the pill can run full-width on
           * mobile. The subtitle is desktop-only in the design — at the
           * narrower widths the pill takes that row instead.
           */}
          <div className="flex w-full flex-col gap-3 md:gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[1.5rem] font-semibold leading-8 text-text lg:text-[2rem] lg:leading-10">
                  Dashboard
                </h1>

                {/*
                 * A scoped viewer is told so at every width. The subtitle below
                 * says it too, but it is desktop-only in the design, and a
                 * mobile reader would otherwise read one person's workload as
                 * the whole business's.
                 */}
                {isScoped ? (
                  <span className="shrink-0 rounded-pill bg-gray-100 px-3 py-1.5 text-small font-medium text-gray-600">
                    Your assigned work
                  </span>
                ) : null}
              </div>
              <p className="hidden text-[0.875rem] leading-5 text-gray-500 lg:block">
                {isScoped
                  ? 'Here’s what’s happening across the work assigned to you today.'
                  : 'Here’s what’s happening across Marty Global LLC today.'}
              </p>
            </div>

            <PeriodFilter value={period} onChange={setPeriod} />
          </div>

          {isError ? (
            <DataErrorState
              title="Couldn't load the dashboard"
              description="None of today's figures loaded, so this is not a quiet day — it's a failed request. Try again in a moment."
              onRetry={() => void query.refetch()}
              isRetrying={query.isFetching}
            />
          ) : isLoading || !summary ? (
            <DashboardSkeleton />
          ) : (
            <>
              <KpiCards metrics={summary.metrics} />

              <OrdersByStatus statuses={summary.ordersByStatus} />

              <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
                <RecentActivity activity={summary.recentActivity} />

                <NeedsAttention
                  total={summary.attention.total}
                  items={summary.attention.items}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
