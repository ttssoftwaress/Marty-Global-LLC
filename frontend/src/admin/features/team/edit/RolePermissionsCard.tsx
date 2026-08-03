import { ChevronDown, RotateCcw, ShieldAlert } from 'lucide-react';
import { useId } from 'react';

import type { TeamRoleOption } from '../../../types/team';
import type { TeamPermissionArea } from '../../../types/team-member-edit';
import { PermissionGrid } from './PermissionGrid';

/*
 * "Role & permissions" — the role select, its helper line, then the permission
 * table.
 *
 * The role options and the area rows both come from the API, so adding an admin
 * section is a backend change and adding a role is something an admin does on
 * the Team & staff screen — neither is a frontend deploy.
 *
 * THE SWITCHES OVERRIDE THE ROLE
 *
 * The role decides where the switches start. Moving one records a decision about
 * this account alone: it is marked "Custom", it stays put when the role is
 * edited later, and it changes nothing for anyone else holding the same role. A
 * switch left alone follows the role.
 *
 * That has to be said on the screen, not just implemented, because the two
 * behaviours are indistinguishable from the switch itself — an admin denying a
 * colleague one section needs to know they have not just edited the role, and an
 * admin editing a role needs to know which accounts it will not reach.
 *
 * The table itself is `PermissionGrid`, shared with the add-staff form and the
 * role editor — it owns the two "Specific data" / "All data" columns, how the
 * pair interacts, and the override mark.
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
  // What the currently selected role grants — the baseline every switch is read
  // against, and what "Use role default" puts a row back to.
  roleGrants: Record<string, boolean>;
  // True when the selected role carries the `admin` authorization role.
  roleGrantsFullAccess: boolean;
  onRoleChange: (next: string) => void;
  onPermissionChange: (key: string, next: boolean) => void;
  onResetPermissions: () => void;
};

export function RolePermissionsCard({
  role,
  roles,
  areas,
  permissions,
  roleGrants,
  roleGrantsFullAccess,
  onRoleChange,
  onPermissionChange,
  onResetPermissions,
}: RolePermissionsCardProps) {
  const roleId = useId();
  const helperId = `${roleId}-helper`;

  const overriddenCount = areas.filter(
    (area) =>
      (permissions[area.key] === true) !== (roleGrants[area.key] === true) ||
      (area.scopeKey !== undefined &&
        (permissions[area.scopeKey] === true) !==
          (roleGrants[area.scopeKey] === true)),
  ).length;

  const roleLabel =
    roles.find((option) => option.value === role)?.label ?? 'this role';

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
          The role sets these switches. Changing one below applies to{' '}
          <span className="text-gray-500">this member only</span> and stays put
          when {roleLabel} is edited later.{' '}
          <span className="text-gray-500">Specific data</span> shows the member
          only the records assigned to them;{' '}
          <span className="text-gray-500">All data</span> shows them everything in
          that area.
        </p>
      </div>

      {/*
       * The one case where the grid below is decoration. The backend's guards let
       * an administrator past every area check before they ever read these
       * switches, so saying nothing here would let an admin carefully deny
       * sections that stay open. A state the design does not cover — logged as a
       * deviation.
       */}
      {roleGrantsFullAccess ? (
        <p className="flex items-start gap-2 rounded-input border border-warning/30 bg-warning/5 px-4 py-3 text-small text-text-secondary">
          <ShieldAlert
            className="mt-0.5 size-[1.125rem] shrink-0 text-warning"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>
            {roleLabel} has administrator access, so this member reaches every
            section regardless of the switches below. Move them to a staff-level
            role to limit what they can open.
          </span>
        </p>
      ) : null}

      {overriddenCount > 0 ? (
        <div className="flex flex-col gap-2 rounded-input border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-small text-text-secondary">
            {overriddenCount === 1
              ? '1 permission is set for this member'
              : `${overriddenCount} permissions are set for this member`}{' '}
            rather than inherited from {roleLabel}.
          </p>

          <button
            type="button"
            onClick={onResetPermissions}
            className="flex shrink-0 items-center gap-1.5 self-start rounded-control text-small font-semibold text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:self-auto"
          >
            <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Reset all to {roleLabel}
          </button>
        </div>
      ) : null}

      <PermissionGrid
        areas={areas}
        permissions={permissions}
        roleGrants={roleGrants}
        onPermissionChange={onPermissionChange}
      />
    </section>
  );
}
