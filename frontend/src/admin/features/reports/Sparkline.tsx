import { useMemo } from 'react';

/*
 * The miniature trend line each KPI card draws beside its figure.
 *
 * It shows shape only — no axis, no ticks, no values — so it is drawn from the
 * plain numbers the KPI carries and takes its hue from the same trend tone that
 * colors the percentage beside it. That is why a falling conversion rate's spark
 * is red on the design while the other three are green: the tone travels with
 * the trend, not with the card.
 *
 * Why hand-drawn SVG rather than a chart library: AGENTS.md's stack table is the
 * budget and no charting library is in it. A polyline through normalized points
 * is cheaper than the dependency. This is data visualization, not iconography —
 * Design.md's "never hand-draw SVGs" rule is about icons, which still come from
 * lucide-react.
 *
 * `preserveAspectRatio="none"` lets one viewBox fill whatever box the card
 * gives it, which is how the same component serves mobile's full-width spark and
 * desktop's 120px one.
 */

const VIEW_W = 120;
const VIEW_H = 32;
// Keeps the stroke's own width from clipping at the extremes of the box.
const PADDING = 3;

type SparklineProps = {
  points: number[];
  tone: 'positive' | 'negative' | 'neutral';
  className?: string;
};

const TONE_STROKE = {
  positive: 'var(--color-success)',
  negative: 'var(--color-error)',
  neutral: 'var(--color-gray-400)',
} as const;

export function Sparkline({ points, tone, className }: SparklineProps) {
  const path = useMemo(() => {
    if (points.length < 2) return '';

    const min = Math.min(...points);
    const max = Math.max(...points);
    // A flat series has no range to normalize against; drawing it down the
    // middle is truer than dividing by zero or pinning it to the floor.
    const span = max - min || 1;
    const step = VIEW_W / (points.length - 1);
    const plotHeight = VIEW_H - PADDING * 2;

    return points
      .map((value, index) => {
        const x = index * step;
        const y = PADDING + (1 - (value - min) / span) * plotHeight;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [points]);

  if (!path) return null;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={path}
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
