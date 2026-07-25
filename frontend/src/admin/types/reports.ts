/*
 * Admin reports & analytics — local mirror of the API shapes the screen renders.
 * The backend is the source of truth (AGENTS.md, two-apps sync rule); these
 * types exist so the UI compiles and composes before the endpoints land.
 *
 * Nothing on the screen is hardcoded business data: the KPI figures, every chart
 * series, the donut breakdowns, and the funnel stages all arrive from the API.
 * Money is an integer minor-unit amount plus its ISO 4217 code everywhere
 * (AGENTS.md, Money rules) — the UI never does arithmetic on it, only formats at
 * render.
 */

import type { Money } from './dashboard';

export type { Money };

/*
 * The report period the header's pill strip selects. Every query on the screen
 * takes it, so one switch re-scopes the whole page rather than each card
 * carrying its own range.
 *
 * `custom` is the design's fourth pill. It opens a range picker rather than
 * resolving to a fixed window, so the queries below carry the chosen dates
 * alongside it — see `ReportRange`.
 */
export type ReportPeriod = '30d' | '90d' | 'ytd' | 'custom';

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

/*
 * The resolved window a query asks for. A fixed period sends only its name and
 * lets the backend resolve the boundaries — which is what keeps the jurisdiction
 * timezone question server-side (AGENTS.md, Dates). A custom range additionally
 * carries the two dates the picker produced.
 */
export type ReportRange = {
  period: ReportPeriod;
  from?: string; // ISO-8601 date, custom range only
  to?: string; // ISO-8601 date, custom range only
};

/*
 * A KPI's movement against the preceding comparable window. The backend decides
 * the direction as well as the figure, so the UI never infers "up is good" — a
 * falling conversion rate is a `down` trend the design prints in the error hue,
 * while a falling refund rate would be `down` and still healthy.
 */
export type TrendDirection = 'up' | 'down' | 'flat';

export type ReportTrend = {
  direction: TrendDirection;
  /** Pre-formatted by the backend: "+12.5%", "-2.1%". */
  label: string;
  /** The window compared against: "vs last month". */
  caption: string;
  /** Whether the movement is good news, which is what colors it. */
  tone: 'positive' | 'negative' | 'neutral';
};

/*
 * One headline KPI. `value` arrives pre-resolved as the string to print
 * ("$127,450", "84", "24.8%") so no money arithmetic happens in the UI.
 *
 * `sparkline` is the miniature series each design card draws beside the figure —
 * plain numbers in the KPI's own unit, since the sparkline shows shape only and
 * never prints a value.
 */
export type ReportKpi = {
  id: string;
  label: string;
  value: string;
  trend: ReportTrend;
  sparkline: number[];
};

/*
 * One bucket of a time series. `label` is the backend's pre-formatted axis
 * caption ("Jan", "Jul 06"), so the chart never has to know how a period is
 * bucketed or in which timezone the boundary falls (AGENTS.md, Dates).
 */
export type TimeSeriesPoint = {
  label: string;
  value: number;
};

/*
 * A single-series chart's whole payload. `maxValue` is the axis ceiling the
 * backend chose: sending it down means the y-axis ticks hold still across a
 * period switch instead of re-scaling to the current bucket's tallest point.
 *
 * `valueKind` tells the axis how to print a tick — a revenue series formats as
 * money against `currency`, a count series as a plain grouped number.
 */
export type ReportSeries = {
  points: TimeSeriesPoint[];
  maxValue: number;
  valueKind: 'money' | 'count';
  currency?: string;
};

/*
 * Customer growth draws two things over one axis: new customers per bucket as
 * bars, and the running total as a line. Both share the bucket labels, so they
 * arrive as one payload with a per-series ceiling — the line's totals dwarf the
 * bars, and plotting them against a single ceiling would flatten the bars to
 * nothing.
 */
export type GrowthSeries = {
  points: { label: string; newCustomers: number; cumulative: number }[];
  maxNewCustomers: number;
  maxCumulative: number;
};

/*
 * One slice of a donut breakdown. The backend supplies the share as well as the
 * count so the UI never divides — and so a rounded set of percentages still
 * reads as the backend intended.
 */
export type BreakdownSlice = {
  id: string;
  label: string;
  count: number;
  /** 0–100, resolved by the backend. */
  percentage: number;
};

/*
 * A whole donut card's payload: the slices plus the figure printed in the hole.
 * `total` is the count; `totalLabel` is the backend's caption for it ("Orders").
 */
export type ReportBreakdown = {
  slices: BreakdownSlice[];
  total: number;
  totalLabel: string;
};

/*
 * One stage of the conversion funnel. `percentage` is the backend's stage-to-
 * stage conversion — the design prints 100% at the top and each later stage's
 * share of the one above it, not its share of the top. `barRatio` is how wide
 * the bar draws (0–1), which the backend resolves against the first stage so the
 * bars stay comparable even when a stage's own conversion is high.
 */
export type FunnelStage = {
  id: string;
  label: string;
  /** Pre-formatted count: "12,480". */
  value: string;
  /** Pre-formatted stage conversion: "100%", "25.0%". */
  percentage: string;
  barRatio: number;
};

/*
 * Everything the screen's chrome needs in one call, so the KPI figures agree
 * with each other and with the charts beneath them.
 */
export type ReportsSummary = {
  kpis: ReportKpi[];
};
