import { FilterSelect } from '../../components/FilterSelect';
import type { CustomerRegionOption } from '../../types/customers';

/*
 * The region filter — the "Region: All regions" control every link shows beside
 * the search field. The shared `FilterSelect` with this screen's control size,
 * which the three links draw differently at each width.
 *
 * The links only show it closed, so the open panel is our design (per Design.md,
 * filling in a state the design did not cover): a card-radius panel on a
 * `shadow-lg-elevation`, anchored under the trigger, listing the regions with a
 * check against the selected one.
 *
 * The trigger prints the design's "Region: <selection>" prefix; the accessible
 * name stays plain so a screen reader announces the control once, not twice.
 */

type CustomerRegionFilterProps = {
  options: CustomerRegionOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function CustomerRegionFilter({
  options,
  value,
  onChange,
  className,
}: CustomerRegionFilterProps) {
  return (
    <FilterSelect
      label="Region"
      captionPrefix="Region: "
      placeholder="All regions"
      options={options}
      value={value}
      onChange={onChange}
      className={className}
      triggerClassName="h-12 px-4 text-body md:h-[2.375rem] md:px-3 md:text-[0.8125rem] lg:h-10 lg:px-4 lg:text-body"
      restingClassName="border-gray-300 text-text hover:bg-gray-50 md:border-gray-200 lg:border-gray-300"
      chevronClassName="size-4 md:size-3.5 lg:size-4"
    />
  );
}
