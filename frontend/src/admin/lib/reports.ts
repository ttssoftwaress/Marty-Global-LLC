import { formatCount, formatMoneyCompact } from './format';
import type { ReportSeries } from '../types/reports';

/*
 * Shared helpers for the reports screen's charts.
 *
 * The categorical palette is the one the donut cards and their legends both key
 * off, in the order the designs use it: brand primary, secondary, info, accent.
 * Reading it from one array is what keeps a slice and its legend swatch the same
 * hue — the alternative is two lists that drift.
 *
 * Colors are design tokens referenced through `var()` rather than hexes, since a
 * chart fill cannot be a Tailwind class (Design.md, no hardcoded hex).
 */

export const CHART_SERIES_COLORS = [
  'var(--color-primary)',
  'var(--color-secondary)',
  'var(--color-info)',
  'var(--color-accent)',
] as const;

// A breakdown with more slices than the palette has entries cycles rather than
// running out — the designs show four, but the backend decides how many.
export function seriesColor(index: number) {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}

/*
 * An axis tick, printed in the series' own unit: a revenue axis reads as money
 * ("$150k"), a count axis as a grouped number ("300"). Money arrives in integer
 * minor units, so it goes through the money formatter rather than being divided
 * here (AGENTS.md, Money rules).
 */
export function formatAxisValue(value: number, series: ReportSeries) {
  if (series.valueKind === 'money') {
    return formatCompactMoney(value, series.currency ?? 'USD');
  }
  return formatCount(value);
}

/*
 * The designs' abbreviated money ticks — "150k", "$1.2M". Full precision on an
 * axis label is unreadable at 12px and the tick only has to convey scale; the
 * tooltip and the KPI cards print the exact figure.
 */
export function formatCompactMoney(amount: number, currency: string) {
  const whole = formatMoneyCompact({ amount, currency });

  // Minor units → major, for the magnitude test only. Never used for arithmetic
  // on a real amount (AGENTS.md, Money rules) — this decides a suffix.
  const major = amount / 100;

  if (Math.abs(major) >= 1_000_000) {
    return `${whole.slice(0, 1)}${(major / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (Math.abs(major) >= 1_000) {
    return `${whole.slice(0, 1)}${Math.round(major / 1_000)}k`;
  }
  return whole;
}

/*
 * The exact figure a chart tooltip prints, in the series' unit.
 */
export function formatSeriesValue(value: number, series: ReportSeries) {
  if (series.valueKind === 'money') {
    return formatMoneyCompact({ amount: value, currency: series.currency ?? 'USD' });
  }
  return formatCount(value);
}

/*
 * Thins a dense x-axis so a 30-bucket month does not print 30 overlapping
 * captions: keeps roughly six, always including the first and the last.
 * Mirrors the payments chart's rule so the two screens' axes read alike.
 */
export function shouldPrintAxisLabel(index: number, total: number) {
  if (total <= 7) return true;
  const stride = Math.ceil(total / 6);
  return index === 0 || index === total - 1 || index % stride === 0;
}

/*
 * Builds the `d` for a donut segment: an annulus arc from `startAngle` to
 * `endAngle`, drawn clockwise from 12 o'clock like every donut in the designs.
 *
 * Angles are degrees. The path is two arcs (outer clockwise, inner back) joined
 * into one closed shape, which is what gives the ring its hole without needing a
 * mask or a second overlaid circle.
 */
export function donutSegmentPath(
  startAngle: number,
  endAngle: number,
  outerRadius: number,
  innerRadius: number,
  cx: number,
  cy: number,
) {
  // A full-circle slice cannot be drawn as a single arc — the start and end
  // points coincide, so the arc collapses. Two half-arcs render the ring.
  const sweep = endAngle - startAngle;
  if (sweep >= 359.999) {
    return [
      ringHalf(cx, cy, outerRadius, innerRadius, 0),
      ringHalf(cx, cy, outerRadius, innerRadius, 180),
    ].join(' ');
  }

  const outerStart = polar(cx, cy, outerRadius, startAngle);
  const outerEnd = polar(cx, cy, outerRadius, endAngle);
  const innerEnd = polar(cx, cy, innerRadius, endAngle);
  const innerStart = polar(cx, cy, innerRadius, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M${outerStart.x} ${outerStart.y}`,
    `A${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L${innerEnd.x} ${innerEnd.y}`,
    `A${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function ringHalf(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  offset: number,
) {
  const a = polar(cx, cy, outer, offset);
  const b = polar(cx, cy, outer, offset + 180);
  const c = polar(cx, cy, inner, offset + 180);
  const d = polar(cx, cy, inner, offset);
  return [
    `M${a.x} ${a.y}`,
    `A${outer} ${outer} 0 0 1 ${b.x} ${b.y}`,
    `L${c.x} ${c.y}`,
    `A${inner} ${inner} 0 0 0 ${d.x} ${d.y}`,
    'Z',
  ].join(' ');
}

// Degrees clockwise from 12 o'clock → SVG coordinates.
function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}
