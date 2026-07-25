import { useMemo, useState } from 'react';

import { AdminLayout } from '../components/AdminLayout';
import {
  BreakdownDonutCard,
  ConversionFunnelCard,
  CustomerGrowthCard,
  ReportsHeader,
  ReportsKpiCards,
  RevenueOverTimeCard,
  useAdminReportsBreakdown,
  useAdminReportsFunnel,
  useAdminReportsGrowth,
  useAdminReportsRevenue,
  useAdminReportsSummary,
} from '../features/reports';
import { useAdminShell } from '../hooks/useAdminShell';
import type { ReportPeriod, ReportRange } from '../types/reports';

/*
 * Reports & analytics — the staff screen for business performance across
 * services, regions, and time.
 *
 * The section order is the same at every width — header, KPIs, revenue over
 * time, the two donut breakdowns, the conversion funnel, customer growth — so
 * one tree covers all three links. What changes is the grid: desktop runs the
 * KPIs 4-up and pairs the donuts in a row, tablet and mobile drop to a 2-up (and
 * then 1-up) KPI grid with every card full width.
 *
 * Every figure, series, slice, and stage comes from the API; nothing on this
 * page is hardcoded business data. Six queries back it (endpoints land later),
 * all scoped by the header's period pill — one control re-scopes the whole page
 * rather than each card carrying its own range.
 *
 * The tablet link shows a different set of KPI labels and a couple of renamed
 * sections. Per Design.md the desktop link is the source of truth for copy
 * across viewports, so its wording is what renders at every width.
 */

export function AdminReportsAnalyticsPage() {
  const { user, onLogout } = useAdminShell();

  const [period, setPeriod] = useState<ReportPeriod>('30d');

  /*
   * A custom range would carry its two dates here once the picker lands; the
   * queries already send them. Memoized so the object identity does not change
   * on every render and re-key all six queries.
   */
  const range = useMemo<ReportRange>(() => ({ period }), [period]);

  const summary = useAdminReportsSummary(range);
  const revenue = useAdminReportsRevenue(range);
  const byService = useAdminReportsBreakdown('service', range);
  const byRegion = useAdminReportsBreakdown('region', range);
  const funnel = useAdminReportsFunnel(range);
  const growth = useAdminReportsGrowth(range);

  /*
   * Export produces a file from the same range the page is showing, so it runs
   * server-side against `GET /v1/admin/reports/export` rather than serializing
   * what the browser happens to have cached. The endpoint lands with the rest of
   * the reports module (AGENTS.md, two-apps sync rule).
   */
  const onExport = () => {};

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 lg:gap-6">
          <ReportsHeader
            period={period}
            onPeriodChange={setPeriod}
            onExport={onExport}
          />

          {summary.isPending ? (
            <div
              className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-6"
              aria-hidden="true"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="h-[132px] animate-pulse rounded-card bg-gray-200"
                />
              ))}
            </div>
          ) : (
            <ReportsKpiCards kpis={summary.data?.kpis ?? []} />
          )}

          <RevenueOverTimeCard series={revenue.data} isLoading={revenue.isPending} />

          {/* The two breakdowns pair on desktop and stack below it. */}
          <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
            <BreakdownDonutCard
              title="Orders by service"
              description="Distribution of orders across core services"
              breakdown={byService.data}
              isLoading={byService.isPending}
            />
            <BreakdownDonutCard
              title="Orders by region"
              description="Geographic distribution of orders"
              breakdown={byRegion.data}
              isLoading={byRegion.isPending}
            />
          </div>

          <ConversionFunnelCard stages={funnel.data} isLoading={funnel.isPending} />

          <CustomerGrowthCard growth={growth.data} isLoading={growth.isPending} />
        </div>
      </div>
    </AdminLayout>
  );
}
