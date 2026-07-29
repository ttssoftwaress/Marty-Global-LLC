import {
  FilterSelect,
  type FilterSelectOption,
} from '../../components/FilterSelect';

/*
 * One of the log's two filter selects — "Date range" and "Request type". The
 * shared `FilterSelect` at this toolbar's tighter size, which steps up from
 * `md`.
 *
 * The links only draw these closed, so the open panel is our design (Design.md):
 * a card-radius panel on a `shadow-lg-elevation`, anchored under the trigger and
 * at least as wide as it, listing the options with a check against the selected
 * one. Built rather than a native `<select>` so the panel matches the rest of
 * the admin chrome.
 *
 * The first option is the pass-through: its label is the control's resting
 * caption ("Date range"), and selecting anything else tints the trigger so an
 * active filter is visible without opening it.
 */

type MailLogFilterSelectProps<T extends string> = {
  label: string; // accessible name, e.g. "Date range"
  options: FilterSelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function MailLogFilterSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: MailLogFilterSelectProps<T>) {
  return (
    <FilterSelect
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      className={className}
      triggerClassName="h-9 px-3 text-small md:h-10 md:px-3.5 md:text-body"
      chevronClassName="size-3 md:size-4"
      panelClassName="min-w-[11.25rem]"
    />
  );
}
