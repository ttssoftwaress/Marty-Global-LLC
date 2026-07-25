import {
  CUSTOMER_DETAIL_TABS,
  type CustomerDetailTab,
} from '../../types/customer-detail';

/*
 * The tab strip under the KPI cards — one pill per section of the customer's
 * record.
 *
 * The strip scrolls horizontally rather than wrapping, so a narrow screen keeps
 * the tabs on one line and the row height stays predictable. The scrollbar is
 * hidden but the strip still scrolls by touch, wheel, and keyboard — which is
 * what the mobile link's clipped fifth pill implies.
 *
 * The links differ on the resting pill: mobile and desktop tint it gray, while
 * tablet leaves it bare on the page background. We use the tinted resting pill at
 * every width (Design.md, logged as a deviation) — two of the three links choose
 * it, and it is what makes the inactive tabs read as controls rather than as
 * labels floating over the background.
 *
 * Rendered as a real tablist, matching the customers list' segment tabs, so the
 * tabs announce as one mutually exclusive choice and each pill controls its
 * panel.
 */

type CustomerDetailTabsProps = {
  value: CustomerDetailTab;
  onChange: (value: CustomerDetailTab) => void;
};

export const customerTabPanelId = (tab: CustomerDetailTab) =>
  `customer-panel-${tab}`;

const tabId = (tab: CustomerDetailTab) => `customer-tab-${tab}`;

export function CustomerDetailTabs({ value, onChange }: CustomerDetailTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Customer sections"
      className="-mx-4 flex w-[calc(100%+2rem)] shrink-0 items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:w-full md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {CUSTOMER_DETAIL_TABS.map((tab) => {
        const isActive = tab.value === value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={tabId(tab.value)}
            aria-selected={isActive}
            aria-controls={customerTabPanelId(tab.value)}
            onClick={() => onChange(tab.value)}
            className={`flex shrink-0 items-center justify-center whitespace-nowrap rounded-pill px-4 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:px-5 md:py-2.5 md:text-[14px] ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 md:text-text-secondary lg:text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
