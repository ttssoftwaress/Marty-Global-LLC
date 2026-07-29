import { useState } from 'react';

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
  useExportReport,
} from '../features/reports';
import { DataErrorState } from '../components/DataErrorState';
import { useAdminShell } from '../hooks/useAdminShell';
import type { ReportPeriod, ReportRange } from '../types/reports';
import { ApiError } from '@/services/api';

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
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  /*
   * The window the six queries actually ask for. It moves to `custom` only once
   * both dates are picked and ordered — the backend rejects a half-filled
   * custom range — so until then the page keeps showing the last resolved
   * window. Held as state (not derived) so the object identity is stable and a
   * keystroke in one date input cannot re-key the queries.
   */
  const [range, setRange] = useState<ReportRange>({ period: '30d' });

  const commitCustom = (from: string, to: string) => {
    if (from && to && from <= to) setRange({ period: 'custom', from, to });
  };

  const onPeriodChange = (next: ReportPeriod) => {
    setPeriod(next);
    if (next === 'custom') commitCustom(customFrom, customTo);
    else setRange({ period: next });
  };

  const onCustomFromChange = (value: string) => {
    setCustomFrom(value);
    commitCustom(value, customTo);
  };

  const onCustomToChange = (value: string) => {
    setCustomTo(value);
    commitCustom(customFrom, value);
  };

  const summary = useAdminReportsSummary(range);
  const revenue = useAdminReportsRevenue(range);
  const byService = useAdminReportsBreakdown('service', range);
  const byRegion = useAdminReportsBreakdown('region', range);
  const funnel = useAdminReportsFunnel(range);
  const growth = useAdminReportsGrowth(range);

  /*
   * Export produces a file from the same range the page is showing, so it runs
   * server-side against `GET /v1/admin/reports/export` rather than serializing
   * what the browser happens to have cached — the file then carries what this
   * actor is entitled to see, not what their browser cached.
   *
   * The button disables while the file is being built (Design.md, in-flight
   * state) and a failure is said beside it rather than swallowed.
   */
  const exportReport = useExportReport();

  const onExport = () => {
    if (exportReport.isPending) return;
    exportReport.mutate(range);
  };

  const exportError = exportReport.isError
    ? exportReport.error instanceof ApiError
      ? exportReport.error.message
      : 'The report could not be exported. Please try again.'
    : null;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6 lg:gap-6">
          <ReportsHeader
            period={period}
            scope={summary.data?.scope}
            onPeriodChange={onPeriodChange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={onCustomFromChange}
            onCustomToChange={onCustomToChange}
            onExport={onExport}
            isExporting={exportReport.isPending}
          />

          {exportError ? (
            <p
              role="alert"
              className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
            >
              {exportError}
            </p>
          ) : null}

          {summary.isPending ? (
            <div
              className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-6"
              aria-hidden="true"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="h-[8.25rem] animate-pulse rounded-card bg-gray-200"
                />
              ))}
            </div>
          ) : summary.isError ? (
            /*
             * Each of the six queries fails on its own, so a dead summary leaves
             * the five charts below it standing. What it must not do is fall
             * through to four cards printing nothing, which reads as a period
             * with no activity rather than a failed request.
             */
            <DataErrorState
              title="Couldn't load the headline figures"
              description="The four KPIs didn't load, so they aren't showing a quiet period — they're showing a failed request. Try again in a moment."
              onRetry={() => void summary.refetch()}
              isRetrying={summary.isFetching}
            />
          ) : (
            <ReportsKpiCards kpis={summary.data?.kpis ?? []} />
          )}

          <RevenueOverTimeCard
            series={revenue.data}
            isLoading={revenue.isPending}
            isError={revenue.isError}
            isRetrying={revenue.isFetching}
            onRetry={() => void revenue.refetch()}
          />

          {/* The two breakdowns pair on desktop and stack below it. */}
          <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
            <BreakdownDonutCard
              title="Orders by service"
              description="Distribution of orders across core services"
              breakdown={byService.data}
              isLoading={byService.isPending}
              isError={byService.isError}
              isRetrying={byService.isFetching}
              onRetry={() => void byService.refetch()}
            />
            <BreakdownDonutCard
              title="Orders by region"
              description="Geographic distribution of orders"
              breakdown={byRegion.data}
              isLoading={byRegion.isPending}
              isError={byRegion.isError}
              isRetrying={byRegion.isFetching}
              onRetry={() => void byRegion.refetch()}
            />
          </div>

          <ConversionFunnelCard
            stages={funnel.data}
            isLoading={funnel.isPending}
            isError={funnel.isError}
            isRetrying={funnel.isFetching}
            onRetry={() => void funnel.refetch()}
          />

          <CustomerGrowthCard
            growth={growth.data}
            isLoading={growth.isPending}
            isError={growth.isError}
            isRetrying={growth.isFetching}
            onRetry={() => void growth.refetch()}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
