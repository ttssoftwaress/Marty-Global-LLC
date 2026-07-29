import { FilterSelect } from '../../components/FilterSelect';
import type { OrderFilterOption } from '../../types/orders';

/*
 * A single filter dropdown for the desktop and tablet toolbars — the "All
 * services" / "All regions" / "Last 30 days" controls. The shared
 * `FilterSelect` with this toolbar's control size.
 *
 * The links only show these in their closed state, so the open popup is our
 * design (per the task): a card-radius panel on a `shadow-lg-elevation`,
 * anchored under the trigger and matched to its width, listing the options with
 * a check against the selected one. It is built rather than a native `<select>`
 * so the panel matches the rest of the admin chrome — the same reason the
 * portal's own filter sheet is hand-built.
 *
 * The trigger label shows the selected option, and picking a non-default one
 * tints the control so an active filter is visible without opening it.
 */

type OrderFilterDropdownProps = {
  label: string; // accessible name, e.g. "Service"
  options: OrderFilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function OrderFilterDropdown({
  label,
  options,
  value,
  onChange,
  className,
}: OrderFilterDropdownProps) {
  return (
    <FilterSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      className={className}
      triggerClassName="h-10 px-4 text-body"
      restingClassName="border-gray-300 text-gray-700 hover:bg-gray-50"
    />
  );
}
