import { useId } from 'react';
import { ShieldAlert } from 'lucide-react';

import { FormDialog } from '../../components/FormDialog';
import { PermissionGrid } from '../team/edit/PermissionGrid';
import type {
  StaffAuthRole,
  StaffAuthRoleOption,
  StaffRoleDraft,
  StaffRoleErrors,
  TeamPermissionArea,
} from '../../types/roles';

/*
 * The create/edit form for a job role, inside the shared admin dialog shell
 * (Design.md — `FormDialog` owns the bottom-sheet-on-mobile / centred-modal
 * panel, and `useOverlay` inside it owns focus and Escape).
 *
 * Three things a role is:
 *   - a name, which is what the team screen's dropdown and every member row
 *     print. It is the only identifier an admin ever sees; the key the API
 *     stores is derived once and never shown.
 *   - an access level, which is the coarse authorization role its members carry.
 *     This is the consequential field, and it is deliberately not derived from
 *     the grid: `Administrator` reaches every section whatever the switches say,
 *     because the backend's guards short-circuit before they read them.
 *   - the grid, which is where members of this role start.
 *
 * The grid here is the same `PermissionGrid` the member forms use, minus the
 * override mark — there is nothing behind a role's own switches to deviate from.
 * Sharing it is what keeps the two screens agreeing on what "All data" means.
 *
 * Editing a built-in role is allowed and renaming it is allowed; changing its
 * access level is not, because the boot-time provisioner reconciles that field
 * and would undo the edit on the next deploy. The control is disabled and says
 * so rather than being hidden, so the current value is still readable.
 *
 * No design covers this screen — the Figma links stop at the team list and the
 * member editor. It follows the member forms' own structure so the three read as
 * one family. Logged as a deviation.
 */

type RoleFormDialogProps = {
  open: boolean;
  // Null while creating; the role being edited otherwise.
  editing: { isSystem: boolean; memberCount: number } | null;
  draft: StaffRoleDraft | null;
  areas: TeamPermissionArea[];
  authRoleOptions: StaffAuthRoleOption[];
  errors: StaffRoleErrors;
  isSaving: boolean;
  error: string | null;
  onChange: (next: Partial<StaffRoleDraft>) => void;
  onPermissionChange: (key: string, granted: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function RoleFormDialog({
  open,
  editing,
  draft,
  areas,
  authRoleOptions,
  errors,
  isSaving,
  error,
  onChange,
  onPermissionChange,
  onClose,
  onSubmit,
}: RoleFormDialogProps) {
  const labelId = useId();
  const accessId = useId();

  const isEditing = editing !== null;
  const lockAccessLevel = editing?.isSystem === true;
  const grantsFullAccess = draft?.authRole === 'admin';

  return (
    <FormDialog
      open={open && draft !== null}
      title={isEditing ? 'Edit role' : 'Create role'}
      description={
        isEditing
          ? 'Changing what this role grants updates everyone who holds it, except where a permission was set for one member individually.'
          : 'Name the role and choose what everyone holding it can reach. You can still adjust an individual member afterwards.'
      }
      size="md"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-3 md:gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-input items-center justify-center rounded-control border border-gray-300 bg-white px-5 text-button text-text transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSaving}
            className="flex h-input min-w-0 items-center justify-center rounded-control bg-primary px-5 text-button text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            {isSaving
              ? isEditing
                ? 'Saving…'
                : 'Creating…'
              : isEditing
                ? 'Save role'
                : 'Create role'}
          </button>
        </div>
      }
    >
      {draft ? (
        <div className="flex w-full flex-col gap-5 md:gap-6">
          <div className="flex w-full flex-col gap-2">
            <label htmlFor={labelId} className="text-form-label text-gray-800">
              Role name
            </label>
            <input
              id={labelId}
              type="text"
              value={draft.label}
              autoComplete="off"
              onChange={(event) => onChange({ label: event.target.value })}
              aria-invalid={errors.label ? true : undefined}
              aria-describedby={errors.label ? `${labelId}-error` : undefined}
              className={`input-field ${errors.label ? 'border-error' : ''}`}
            />
            {errors.label ? (
              <p id={`${labelId}-error`} className="text-small text-error">
                {errors.label}
              </p>
            ) : null}
          </div>

          <fieldset className="flex w-full flex-col gap-3">
            <legend className="text-form-label text-gray-800">Access level</legend>

            {authRoleOptions.map((option) => (
              <label
                key={option.value}
                className={`flex w-full items-start gap-3 rounded-input border p-4 transition-colors ${
                  draft.authRole === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 bg-white'
                } ${lockAccessLevel ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-gray-300'}`}
              >
                <input
                  type="radio"
                  name={accessId}
                  value={option.value}
                  checked={draft.authRole === option.value}
                  disabled={lockAccessLevel}
                  onChange={() =>
                    onChange({ authRole: option.value as StaffAuthRole })
                  }
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-form-label text-text">{option.label}</span>
                  <span className="text-small leading-[1.4] text-text-secondary">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}

            {lockAccessLevel ? (
              <p className="text-small text-gray-400">
                Built-in roles keep their access level. Create a role if you need
                a different one.
              </p>
            ) : null}
          </fieldset>

          {grantsFullAccess ? (
            <p className="flex items-start gap-2 rounded-input border border-warning/30 bg-warning/5 px-4 py-3 text-small text-text-secondary">
              <ShieldAlert
                className="mt-0.5 size-[1.125rem] shrink-0 text-warning"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>
                Administrators reach every section regardless of the switches
                below, and can create and edit staff accounts. The switches still
                decide what a member sees if the role is later moved to staff
                level.
              </span>
            </p>
          ) : null}

          <div className="flex w-full flex-col gap-2">
            <h3 className="text-form-label uppercase tracking-[0.6px] text-gray-500">
              Permissions
            </h3>
            <p className="text-small leading-[1.4] text-gray-400">
              Where members of this role start.{' '}
              <span className="text-gray-500">Specific data</span> shows them only
              the records assigned to them;{' '}
              <span className="text-gray-500">All data</span> shows them
              everything in that area.
            </p>
          </div>

          {/*
           * The one thing an admin needs told before saving: this write is not
           * scoped to one person. Shown only when editing, and only when the role
           * has members — creating one moves nobody.
           */}
          {isEditing && editing.memberCount > 0 ? (
            <p className="rounded-input border border-gray-200 bg-gray-50 px-4 py-3 text-small text-text-secondary">
              {editing.memberCount === 1
                ? '1 team member holds this role'
                : `${editing.memberCount} team members hold this role`}{' '}
              and will be updated when you save. Permissions set individually on a
              member stay as they are.
            </p>
          ) : null}

          <PermissionGrid
            areas={areas}
            permissions={draft.permissions}
            onPermissionChange={onPermissionChange}
          />

          {error ? (
            <p
              role="alert"
              className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </FormDialog>
  );
}
