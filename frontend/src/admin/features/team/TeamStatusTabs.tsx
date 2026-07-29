import { TabStrip } from '../../components/TabStrip';
import type { TeamStatusFilter, TeamStatusTab } from '../../types/team';

/*
 * The status tab strip — All / Active / Deactivated, on the shared admin
 * `TabStrip`.
 *
 * The shape is the same at every width; only the pill height changes (2.5rem on
 * desktop, 36px from tablet down, matching the links).
 *
 * Labels come from the API. A count is rendered only when the backend sends one:
 * the links print bare labels here.
 */

type TeamStatusTabsProps = {
  tabs: TeamStatusTab[];
  value: TeamStatusFilter;
  onChange: (value: TeamStatusFilter) => void;
};

export function TeamStatusTabs({ tabs, value, onChange }: TeamStatusTabsProps) {
  return (
    <TabStrip
      tabs={tabs}
      value={value}
      onChange={onChange}
      ariaLabel="Filter team members by status"
      className="shrink-0 md:w-auto"
      tabClassName="h-9 text-body lg:h-10"
    />
  );
}
