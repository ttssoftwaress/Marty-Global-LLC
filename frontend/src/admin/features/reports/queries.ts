import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  GrowthSeries,
  FunnelStage,
  ReportBreakdown,
  ReportRange,
  ReportSeries,
  ReportsSummary,
} from '../../types/reports';

/*
 * Admin reports & analytics data layer. Six queries back the screen (endpoints
 * land later, AGENTS.md two-apps sync rule):
 *   - the summary: the four headline KPI figures and their sparklines
 *   - revenue over time
 *   - the orders-by-service and orders-by-region donut breakdowns
 *   - the conversion funnel
 *   - customer growth (bars + cumulative line)
 *
 * Every one of them is scoped by the header's period pill, so the whole page
 * re-scopes from one control rather than each card carrying its own range. The
 * range is part of every query key, which is what makes a period switch a
 * cache lookup on the way back rather than a refetch.
 *
 * The backend resolves what a period means — including where the boundaries
 * fall and in which timezone (AGENTS.md, Dates). The UI only sends the name and
 * the two dates a custom range picked.
 */

// The range as query params. A fixed period sends its name alone; a custom
// range adds the dates, which is the only case the UI knows a boundary at all.
function rangeParams(range: ReportRange) {
  const query = new URLSearchParams({ period: range.period });
  if (range.period === 'custom') {
    if (range.from) query.set('from', range.from);
    if (range.to) query.set('to', range.to);
  }
  return query.toString();
}

// Serializes the range into the query key so two different custom windows never
// share a cache entry.
const rangeKey = (range: ReportRange) =>
  [range.period, range.from ?? null, range.to ?? null] as const;

/*
 * Keeping the previous data on screen while the next period loads is what stops
 * every card collapsing to a skeleton on each pill press. Shared by all six.
 */
const keepPrevious = { placeholderData: <T,>(previous: T) => previous };

export const adminReportsSummaryKey = (range: ReportRange) =>
  ['admin', 'reports', 'summary', ...rangeKey(range)] as const;

// GET /v1/admin/reports/summary?period= — the four KPI figures and sparklines.
export function useAdminReportsSummary(range: ReportRange) {
  return useQuery({
    queryKey: adminReportsSummaryKey(range),
    queryFn: () =>
      apiFetch<ApiSuccess<ReportsSummary>>(
        `/admin/reports/summary?${rangeParams(range)}`,
      ).then((res) => res.data),
    ...keepPrevious,
  });
}

export const adminReportsRevenueKey = (range: ReportRange) =>
  ['admin', 'reports', 'revenue', ...rangeKey(range)] as const;

// GET /v1/admin/reports/revenue?period= — the bucketed revenue series plus the
// axis ceiling the backend chose.
export function useAdminReportsRevenue(range: ReportRange) {
  return useQuery({
    queryKey: adminReportsRevenueKey(range),
    queryFn: () =>
      apiFetch<ApiSuccess<ReportSeries>>(
        `/admin/reports/revenue?${rangeParams(range)}`,
      ).then((res) => res.data),
    ...keepPrevious,
  });
}

export const adminReportsBreakdownKey = (
  dimension: 'service' | 'region',
  range: ReportRange,
) => ['admin', 'reports', 'breakdown', dimension, ...rangeKey(range)] as const;

/*
 * GET /v1/admin/reports/breakdown/:dimension?period= — the donut cards. Both
 * cards run the same query against a different dimension, so the two stay in
 * step and a third breakdown needs no new hook.
 */
export function useAdminReportsBreakdown(
  dimension: 'service' | 'region',
  range: ReportRange,
) {
  return useQuery({
    queryKey: adminReportsBreakdownKey(dimension, range),
    queryFn: () =>
      apiFetch<ApiSuccess<ReportBreakdown>>(
        `/admin/reports/breakdown/${dimension}?${rangeParams(range)}`,
      ).then((res) => res.data),
    ...keepPrevious,
  });
}

export const adminReportsFunnelKey = (range: ReportRange) =>
  ['admin', 'reports', 'funnel', ...rangeKey(range)] as const;

/*
 * GET /v1/admin/reports/funnel?period= — the ordered funnel stages. The backend
 * owns both the stage-to-stage conversion and the bar width, so the UI never
 * derives one figure from another.
 */
export function useAdminReportsFunnel(range: ReportRange) {
  return useQuery({
    queryKey: adminReportsFunnelKey(range),
    queryFn: () =>
      apiFetch<ApiSuccess<{ stages: FunnelStage[] }>>(
        `/admin/reports/funnel?${rangeParams(range)}`,
      ).then((res) => res.data.stages),
    ...keepPrevious,
  });
}

export const adminReportsGrowthKey = (range: ReportRange) =>
  ['admin', 'reports', 'growth', ...rangeKey(range)] as const;

// GET /v1/admin/reports/growth?period= — new customers per bucket plus the
// running total, with a ceiling for each so the bars are not flattened by the
// cumulative line's scale.
export function useAdminReportsGrowth(range: ReportRange) {
  return useQuery({
    queryKey: adminReportsGrowthKey(range),
    queryFn: () =>
      apiFetch<ApiSuccess<GrowthSeries>>(
        `/admin/reports/growth?${rangeParams(range)}`,
      ).then((res) => res.data),
    ...keepPrevious,
  });
}
