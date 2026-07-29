import { TabStrip } from '../../components/TabStrip';
import type { CustomerSegment, CustomerSegmentTab } from '../../types/customers';

/*
 * The segment tab strip — one pill per cohort, on the shared admin `TabStrip`.
 * The shape is the same at every width; only the scale changes (0.875rem labels
 * on desktop, 13px on tablet, 12px on mobile, matching the links).
 *
 * Labels come from the API. A count is rendered only when the backend sends one:
 * the links print bare labels here, unlike the orders queue's counted tabs.
 */

type CustomerSegmentTabsProps = {
  tabs: CustomerSegmentTab[];
  value: CustomerSegment;
  onChange: (value: CustomerSegment) => void;
};

export function CustomerSegmentTabs({
  tabs,
  value,
  onChange,
}: CustomerSegmentTabsProps) {
  return (
    <TabStrip
      tabs={tabs}
      value={value}
      onChange={onChange}
      ariaLabel="Filter customers by segment"
      className="shrink-0 md:w-full md:gap-1.5 lg:gap-2"
      tabClassName="text-small md:px-3.5 md:text-[0.8125rem] lg:px-4 lg:text-[0.875rem]"
      activeTabClassName="md:font-semibold"
    />
  );
}
