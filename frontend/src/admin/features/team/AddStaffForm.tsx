import { useId, useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';

import type { TeamRoleOption } from '../../types/team';
import type {
  TeamMemberCreateDraft,
  TeamMemberEditErrors,
  TeamPermissionArea,
} from '../../types/team-member-edit';
import { PermissionGrid } from './edit/PermissionGrid';
import { TeamToggleSwitch } from './edit/TeamToggleSwitch';

/*
 * "Add staff member" — the form inside the dialog. It creates the login itself:
 * the name and email the member signs in with, the password an admin sets for
 * them, the role they hold, and their per-area access.
 *
 * The design has no such screen (the links only cover an invite button that was
 * never specified), so this follows the edit screen's own two sections —
 * account details, then role & permissions — so creating a member and editing
 * one read as the same form. Logged as a deviation.
 *
 * The role options and the permission areas come from the API exactly as they do
 * on the edit screen, so adding an admin section or a role stays a backend
 * change rather than a frontend deploy.
 *
 * The permission grid is disclosed rather than always open: choosing a role is
 * the normal path, and its defaults are applied server-side. Opening the grid is
 * what turns the map from "untouched — use the role's defaults" into an explicit
 * per-area override, which is why the toggle also seeds it from the defaults the
 * caller passes.
 */

type AddStaffFormProps = {
  draft: TeamMemberCreateDraft;
  roles: TeamRoleOption[];
  areas: TeamPermissionArea[];
  errors: TeamMemberEditErrors;
  onChange: (next: Partial<TeamMemberCreateDraft>) => void;
  onPermissionChange: (key: string, granted: boolean) => void;
};

export function AddStaffForm({
  draft,
  roles,
  areas,
  errors,
  onChange,
  onPermissionChange,
}: AddStaffFormProps) {
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const roleId = useId();
  const helperId = `${roleId}-helper`;

  const [showPassword, setShowPassword] = useState(false);

  // The grid opens by itself once any area has been set, so a validation error
  // or a reopened dialog never hides overrides the admin already made.
  const hasOverrides = Object.keys(draft.permissions).length > 0;
  const [showPermissions, setShowPermissions] = useState(false);
  const permissionsOpen = showPermissions || hasOverrides;

  return (
    <div className="flex w-full flex-col gap-5 md:gap-6">
      <section className="flex w-full flex-col gap-4 md:gap-5">
        <h3 className="text-form-label uppercase tracking-[0.6px] text-gray-500">
          Account details
        </h3>

        <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:gap-5">
          <div className="flex w-full min-w-0 flex-col gap-2 md:flex-1">
            <label htmlFor={nameId} className="text-form-label text-gray-800">
              Full name
            </label>
            <input
              id={nameId}
              type="text"
              value={draft.name}
              autoComplete="off"
              onChange={(event) => onChange({ name: event.target.value })}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
              className={`input-field ${errors.name ? 'border-error' : ''}`}
            />
            {errors.name ? (
              <p id={`${nameId}-error`} className="text-small text-error">
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 md:flex-1">
            <label htmlFor={emailId} className="text-form-label text-gray-800">
              Email address
            </label>
            <input
              id={emailId}
              type="email"
              value={draft.email}
              autoComplete="off"
              onChange={(event) => onChange({ email: event.target.value })}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              className={`input-field ${errors.email ? 'border-error' : ''}`}
            />
            {errors.email ? (
              <p id={`${emailId}-error`} className="text-small text-error">
                {errors.email}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2">
          <label htmlFor={passwordId} className="text-form-label text-gray-800">
            Password
          </label>

          <div className="relative w-full">
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              value={draft.password}
              // A password an admin is setting for someone else — the browser
              // must not offer to fill or save it against the admin's own login.
              autoComplete="new-password"
              onChange={(event) => onChange({ password: event.target.value })}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password ? `${passwordId}-error` : `${passwordId}-hint`
              }
              className={`input-field w-full pr-12 ${errors.password ? 'border-error' : ''}`}
            />

            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-gray-500 transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {showPassword ? (
                <EyeOff className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Eye className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>

          {errors.password ? (
            <p id={`${passwordId}-error`} className="text-small text-error">
              {errors.password}
            </p>
          ) : (
            <p id={`${passwordId}-hint`} className="text-small text-gray-400">
              At least 8 characters. Share it with the member directly — they can
              change it from their own account.
            </p>
          )}
        </div>

        <hr className="w-full border-t border-gray-200" />

        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-form-label text-gray-800">Member status</p>
            <p className="text-small leading-[1.3] text-text-secondary">
              {draft.isActive
                ? 'Active — the account can sign in as soon as it is created.'
                : 'Deactivated — the account is created but cannot sign in yet.'}
            </p>
          </div>

          <TeamToggleSwitch
            checked={draft.isActive}
            onChange={(isActive) => onChange({ isActive })}
            label="Member status"
          />
        </div>
      </section>

      <section className="flex w-full flex-col gap-4 md:gap-5">
        <h3 className="text-form-label uppercase tracking-[0.6px] text-gray-500">
          Role &amp; permissions
        </h3>

        <div className="flex w-full flex-col gap-2">
          <label htmlFor={roleId} className="text-form-label text-gray-800">
            Role
          </label>

          <div className="relative w-full">
            <select
              id={roleId}
              value={draft.role}
              onChange={(event) => onChange({ role: event.target.value })}
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
            The role applies its default permissions. Customise them below if this
            member needs different access.
          </p>
        </div>

        {permissionsOpen ? (
          <PermissionGrid
            areas={areas}
            permissions={draft.permissions}
            onPermissionChange={onPermissionChange}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowPermissions(true)}
            className="self-start rounded-control text-body font-semibold text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Customise permissions
          </button>
        )}
      </section>
    </div>
  );
}
