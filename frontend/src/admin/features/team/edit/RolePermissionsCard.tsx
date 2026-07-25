import { ChevronDown } from 'lucide-react';
import { useId, type CSSProperties } from 'react';

import type { TeamRoleOption } from '../../../types/team';
import type { TeamPermissionArea } from '../../../types/team-member-edit';
import { TeamToggleSwitch } from './TeamToggleSwitch';

/*
 * "Role & permissions" — the role select, its helper line, then one switch per
 * area of the admin portal.
 *
 * The role options and the area rows both come from the API, so adding an admin
 * section or a role is a backend change rather than a frontend deploy.
 *
 * The grid is where the three links differ. Desktop and mobile run one column
 * top to bottom; tablet splits the same rows into two columns filled
 * column-major (Dashboard, Customers, Support inbox … on the left; Orders
 * queue, Quotes & payments … on the right). That is `grid-flow-col` with an
 * explicit row count at `md` only — the row order in the DOM is the desktop
 * order, so the reading order stays correct at every width and the tablet
 * columns fall out of the flow rather than out of a second markup tree.
 *
 * Two smaller design artifacts are not reproduced, both logged as deviations:
 * the tablet link italicises the helper line and drops the row labels from
 * medium to regular weight, while desktop and mobile do neither. The desktop
 * link is the source of truth for type, so all three widths use the upright
 * helper line and medium row labels.
 */

type RolePermissionsCardProps = {
  role: string;
  roles: TeamRoleOption[];
  areas: TeamPermissionArea[];
  permissions: Record<string, boolean>;
  onRoleChange: (next: string) => void;
  onPermissionChange: (key: string, next: boolean) => void;
};

export function RolePermissionsCard({
  role,
  roles,
  areas,
  permissions,
  onRoleChange,
  onPermissionChange,
}: RolePermissionsCardProps) {
  const roleId = useId();
  const helperId = `${roleId}-helper`;

  // Tablet's two columns are filled top-to-bottom, left column first, so the
  // left column takes the ceiling when the area count is odd.
  const tabletRows = Math.ceil(areas.length / 2);

  return (
    <section className="flex w-full flex-col gap-5 rounded-card border border-gray-200 bg-white p-5 shadow-sm-elevation md:gap-card md:p-card">
      <h2 className="text-h6 text-text">Role &amp; permissions</h2>

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={roleId} className="text-form-label text-gray-800">
          Role
        </label>

        <div className="relative w-full">
          <select
            id={roleId}
            value={role}
            onChange={(event) => onRoleChange(event.target.value)}
            aria-describedby={helperId}
            className="input-field w-full cursor-pointer appearance-none truncate pr-11"
          >
            {roles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 size-[18px] -translate-y-1/2 text-gray-500"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>

        <p id={helperId} className="text-small leading-[1.4] text-gray-400">
          Choosing a role applies its default permissions — adjust individual
          areas below.
        </p>
      </div>

      <div
        className="grid w-full grid-flow-row grid-cols-1 md:grid-flow-col md:grid-cols-2 md:grid-rows-[var(--tablet-rows)] md:gap-x-8 lg:grid-flow-row lg:grid-cols-1 lg:grid-rows-none"
        style={{ '--tablet-rows': `repeat(${tabletRows}, auto)` } as CSSProperties}
      >
        {areas.map((area) => (
          <div
            key={area.key}
            className="flex items-center justify-between gap-4 border-b border-gray-200 py-4 md:py-3 lg:py-4"
          >
            <p className="min-w-0 text-form-label text-gray-800">{area.label}</p>

            <TeamToggleSwitch
              checked={permissions[area.key] === true}
              onChange={(next) => onPermissionChange(area.key, next)}
              label={area.label}
              disabled={area.locked}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
