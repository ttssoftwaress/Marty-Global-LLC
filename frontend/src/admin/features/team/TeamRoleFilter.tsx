import { FilterSelect } from '../../components/FilterSelect';
import type { TeamRoleOption } from '../../types/team';

/*
 * The role filter — the "All roles" control every link shows beside the search
 * field. The shared `FilterSelect` with this screen's control size.
 *
 * The links only show it closed, so the open panel is our design (Design.md,
 * filling in a state the design did not cover): a card-radius panel on a
 * `shadow-lg-elevation`, anchored under the trigger, listing the roles with a
 * check against the selected one. Built rather than a native `<select>` so the
 * panel matches the rest of the admin chrome.
 *
 * Picking a role other than the pass-through tints the closed control, so an
 * active filter is visible without opening it.
 */

type TeamRoleFilterProps = {
  options: TeamRoleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function TeamRoleFilter({
  options,
  value,
  onChange,
  className,
}: TeamRoleFilterProps) {
  return (
    <FilterSelect
      label="Role"
      placeholder="All roles"
      options={options}
      value={value}
      onChange={onChange}
      className={className}
      triggerClassName="h-input px-4 text-body font-medium"
    />
  );
}
