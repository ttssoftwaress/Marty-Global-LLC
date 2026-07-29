import { ChartCard } from './ChartCard';
import type { FunnelStage } from '../../types/reports';

/*
 * "Conversion funnel" — the stage list, each a labelled bar with its count
 * inside and its stage conversion on the right.
 *
 * Desktop and tablet lay a row out as three columns: the stage name in a fixed
 * 160px column, the bar filling the middle, and the percentage right-aligned in
 * a 48px column. Mobile has no room for that, so the name moves above the bar
 * and the percentage sits beside it on the same line — which is what the mobile
 * link shows.
 *
 * Bar widths come from the backend's `barRatio`, not from the percentage beside
 * them: the two answer different questions (share of the top stage vs conversion
 * from the previous one), and the design's bars are drawn against the first
 * stage. Deriving one from the other would misdraw every funnel where they
 * diverge.
 *
 * The count sits inside the bar on the design. A short bar cannot hold its
 * label, so below a fill ratio that can fit it the count moves outside and
 * switches to the text color — otherwise "12,480" would overflow a 40px bar in
 * white on white.
 */

// Below this fill ratio the in-bar label will not fit, so it moves outside.
const LABEL_INSIDE_MIN_RATIO = 0.12;

type ConversionFunnelCardProps = {
  stages: FunnelStage[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
};

export function ConversionFunnelCard({
  stages,
  isLoading,
  isError,
  isRetrying,
  onRetry,
}: ConversionFunnelCardProps) {
  return (
    <ChartCard
      title="Conversion funnel"
      description="Stage drop-offs from discovery to final checkout"
      isLoading={isLoading}
      isError={isError}
      isRetrying={isRetrying}
      onRetry={onRetry}
      errorTitle="Couldn't load the conversion funnel"
      skeletonClassName="h-[13.75rem]"
    >
      {stages && stages.length > 0 ? (
        <ol className="flex w-full flex-col gap-4">
          {stages.map((stage, index) => (
            <FunnelRow key={stage.id} stage={stage} index={index} />
          ))}
        </ol>
      ) : (
        <div className="flex h-[11.25rem] w-full items-center justify-center rounded-input bg-gray-50">
          <p className="text-small text-gray-500">
            No funnel activity recorded for this period yet
          </p>
        </div>
      )}
    </ChartCard>
  );
}

function FunnelRow({ stage, index }: { stage: FunnelStage; index: number }) {
  // Each stage down the funnel is drawn a step lighter, as every link shows.
  const fillOpacity = Math.max(1 - index * 0.1, 0.5);
  const ratio = Math.min(Math.max(stage.barRatio, 0), 1);
  const labelInside = ratio >= LABEL_INSIDE_MIN_RATIO;

  return (
    <li className="flex w-full flex-col gap-1.5 md:flex-row md:items-center md:gap-6">
      {/*
       * Mobile puts the stage name and its percentage on one line above the bar;
       * from `md` they become the outer columns of a three-column row.
       */}
      <div className="flex items-center justify-between gap-3 md:contents">
        <p className="text-body font-semibold leading-6 text-[var(--color-gray-900)] md:w-[10rem] md:shrink-0 md:order-1">
          {stage.label}
        </p>
        <p className="shrink-0 whitespace-nowrap text-body font-bold leading-6 text-[var(--color-text-secondary)] md:order-3 md:w-12 md:text-right">
          {stage.percentage}
        </p>
      </div>

      <div className="relative h-6 w-full min-w-0 overflow-hidden rounded-[0.375rem] bg-[var(--table-header-bg)] md:order-2 md:flex-1">
        <div
          className="h-full rounded-[0.375rem] bg-primary transition-[width] duration-300"
          style={{ width: `${ratio * 100}%`, opacity: fillOpacity }}
        />

        <span
          className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[0.8125rem] font-semibold leading-[1.3] ${
            labelInside ? 'left-3 text-white' : 'text-[var(--color-gray-900)]'
          }`}
          style={labelInside ? undefined : { left: `calc(${ratio * 100}% + 8px)` }}
        >
          {stage.value}
        </span>
      </div>
    </li>
  );
}
