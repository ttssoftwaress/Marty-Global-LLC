import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

import type { TeamRoleOption } from '../../../types/team';
import type { TeamPermissionArea } from '../../../types/team-member-edit';
import { PermissionGrid } from './PermissionGrid';

/*
 * "Role & permissions" — the role select, its helper line, then the permission
 * table.
 *
 * The role options and the area rows both come from the API, so adding an admin
 * section or a role is a backend change rather than a frontend deploy.
 *
 * The table itself is `PermissionGrid`, shared with the add-staff form — it owns
 * the two "Specific data" / "All data" columns and how the pair interacts.
 *
 * The previous tablet layout (the same rows split column-major into two halves)
 * is gone, logged as a deviation: a row now carries two switches under a header
 * that names them, and splitting those rows into side-by-side halves would put
 * four switches on a line under one set of headings.
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
            className="pointer-events-none absolute right-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-gray-500"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>

        <p id={helperId} className="text-small leading-[1.4] text-gray-400">
          Choosing a role applies its default permissions — adjust individual
          areas below. <span className="text-gray-500">Specific data</span> shows
          the member only the records assigned to them;{' '}
          <span className="text-gray-500">All data</span> shows them everything
          in that area.
        </p>
      </div>

      <PermissionGrid
        areas={areas}
        permissions={permissions}
        onPermissionChange={onPermissionChange}
      />
    </section>
  );
}
