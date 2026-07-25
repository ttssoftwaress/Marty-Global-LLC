import { useState } from 'react';

import { AdminLayout } from '../components/AdminLayout';
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
            className="h-[120px] animate-pulse rounded-card bg-gray-200"
          />
        ))}
      </div>

      <div className="h-[180px] w-full animate-pulse rounded-card bg-gray-200" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="h-[420px] min-w-0 flex-1 animate-pulse rounded-card bg-gray-200" />
        <div className="h-[420px] animate-pulse rounded-card bg-gray-200 lg:w-[348px] lg:shrink-0" />
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

  return (
    <AdminLayout
      user={user}
      notificationCount={summary?.attention.total}
      onLogout={onLogout}
    >
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 lg:gap-8">
          {/*
           * Desktop puts the title block and the period pill on one line;
           * tablet and mobile stack them, so the pill can run full-width on
           * mobile. The subtitle is desktop-only in the design — at the
           * narrower widths the pill takes that row instead.
           */}
          <div className="flex w-full flex-col gap-3 md:gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-[24px] font-semibold leading-8 text-text lg:text-[32px] lg:leading-10">
                Dashboard
              </h1>
              <p className="hidden text-[14px] leading-5 text-gray-500 lg:block">
                Here&rsquo;s what&rsquo;s happening across Marty Global LLC today.
              </p>
            </div>

            <PeriodFilter value={period} onChange={setPeriod} />
          </div>

          {isLoading || !summary ? (
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
