import { TabStrip } from '../../components/TabStrip';
import type { AuditCategoryOption } from '../../types/audit';

/*
 * The category tab strip — All activity / Authentication / Orders / … on the
 * shared admin `TabStrip`.
 *
 * Labels and values come from the API; the strip renders whatever the backend
 * publishes, so a new audited category needs no change here.
 *
 * It scrolls horizontally rather than wrapping (the shared strip's behaviour).
 * There are ten categories, which is more than any other tab strip in the admin
 * portal, and wrapping them would cost three rows of vertical space above a list
 * that is already long.
 *
 * A count is rendered only when the backend sends one — it does not for these,
 * because a per-category count would be its own query over a very large table on
 * every page load. The tabs read fine without them, and the list's own total
 * gives the number once a category is picked.
 */

type AuditCategoryTabsProps = {
  tabs: AuditCategoryOption[];
  value: string;
  onChange: (value: string) => void;
};

export function AuditCategoryTabs({
  tabs,
  value,
  onChange,
}: AuditCategoryTabsProps) {
  return (
    <TabStrip
      tabs={tabs}
      value={value}
      onChange={onChange}
      ariaLabel="Filter the audit log by category"
      className="md:w-full"
      tabClassName="h-9 text-body lg:h-10"
    />
  );
}
