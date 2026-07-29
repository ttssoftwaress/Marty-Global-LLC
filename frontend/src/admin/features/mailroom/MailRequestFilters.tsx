import {
  MAIL_REQUEST_FILTERS,
  type MailRequestFilter,
} from '../../types/mailroom';

/*
 * The queue's secondary filter strip — the smaller row of pills beneath the
 * section tabs.
 *
 * Deliberately a different shape from `MailOpsTabs` above it: shorter pills, a
 * 13px/12px label, and a grey `f1f5f9` fill on the inactive ones rather than
 * the tab strip's `gray-200`. That contrast is what the design uses to rank the
 * two rows, so the strips are separate components rather than one parameterised
 * one.
 *
 * Desktop and tablet hug their labels and sit left. Mobile keeps them on one
 * line and scrolls the strip sideways rather than wrapping, matching how the
 * tab strip above already behaves at that width.
 *
 * Rendered as a real tablist so the four pills announce as one mutually
 * exclusive choice.
 */

type MailRequestFiltersProps = {
  value: MailRequestFilter;
  onChange: (value: MailRequestFilter) => void;
};

export function MailRequestFilters({ value, onChange }: MailRequestFiltersProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter requests"
      className="flex w-full items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] lg:gap-2 [&::-webkit-scrollbar]:hidden"
    >
      {MAIL_REQUEST_FILTERS.map((filter) => {
        const isActive = filter.value === value;

        return (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(filter.value)}
            className={`flex shrink-0 items-center justify-center whitespace-nowrap rounded-pill px-3 py-1.5 text-small transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:px-4 lg:py-2 lg:text-[0.8125rem] ${
              isActive
                ? 'bg-primary font-semibold text-white'
                : 'bg-[#f1f5f9] font-medium text-text-secondary hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
