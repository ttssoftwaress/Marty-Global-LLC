import { useMemo, useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';

import { ApiError } from '@/services/api';
import { DataErrorState } from '../../components/DataErrorState';
import type {
  AdminStaffRole,
  StaffRoleDraft,
  StaffRoleErrors,
  TeamPermissionArea,
} from '../../types/roles';
import { DeleteRoleDialog } from './DeleteRoleDialog';
import { RoleFormDialog } from './RoleFormDialog';
import {
  useAdminRoles,
  useCreateStaffRole,
  useDeleteStaffRole,
  useUpdateStaffRole,
} from './queries';

/*
 * Roles — the definitions behind the team list's role column, on the same screen
 * as the members who hold them.
 *
 * It is a section of Team & staff rather than its own route because the two are
 * one job: an admin reads "Reviewer / Compliance" on a member's row and needs to
 * find out what that actually grants without losing the list. Keeping it here
 * also means the count beside each role — how many people hold it — is beside
 * the list of those people.
 *
 * One card per role at every width, because a role's row carries five things
 * (name, access level, member count, a permission summary, and two actions) and
 * a table that fits those on a phone would be a table nobody can read. The card
 * reflows instead: the actions drop under the text below `sm`, and the grid runs
 * one, two, then three columns as the viewport allows.
 *
 * No design covers this section — the Figma links stop at the team list and the
 * member editor. Logged as a deviation.
 */

const EMPTY_DRAFT: StaffRoleDraft = {
  label: '',
  authRole: 'staff',
  permissions: {},
};

// A count of what a role actually opens, so a card says something without
// listing fifteen area names. Scope companions are excluded — they widen a
// section rather than being one.
function grantedAreaCount(
  role: AdminStaffRole,
  areas: TeamPermissionArea[],
): number {
  return areas.filter((area) => role.permissions[area.key] === true).length;
}

function validateRoleDraft(draft: StaffRoleDraft): StaffRoleErrors {
  const errors: StaffRoleErrors = {};
  const label = draft.label.trim();

  if (!label) errors.label = 'Give the role a name.';
  else if (label.length < 2) errors.label = 'Use at least 2 characters.';

  return errors;
}

const message = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function RolesPanel() {
  const roles = useAdminRoles();
  const createRole = useCreateStaffRole();
  const updateRole = useUpdateStaffRole();
  const deleteRole = useDeleteStaffRole();

  /*
   * The draft lives here rather than in the dialog so closing and reopening
   * starts clean, and so a refused save keeps what was typed instead of making
   * the admin reassemble a permission grid.
   */
  const [draft, setDraft] = useState<StaffRoleDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminStaffRole | null>(null);

  const areas = roles.data?.permissionAreas ?? [];

  const editing = useMemo(
    () => roles.data?.roles.find((role) => role.id === editingId) ?? null,
    [roles.data, editingId],
  );

  const errors = useMemo(
    () => (draft ? validateRoleDraft(draft) : {}),
    [draft],
  );
  const hasErrors = Object.keys(errors).length > 0;

  const isSaving = createRole.isPending || updateRole.isPending;

  const openCreate = () => {
    createRole.reset();
    updateRole.reset();
    setEditingId(null);
    setShowErrors(false);
    // Everything off: a new role grants nothing until somebody says otherwise,
    // which is the only safe default for a control that hands out access.
    setDraft({ ...EMPTY_DRAFT, permissions: {} });
  };

  const openEdit = (role: AdminStaffRole) => {
    createRole.reset();
    updateRole.reset();
    setEditingId(role.id);
    setShowErrors(false);
    setDraft({
      label: role.label,
      authRole: role.authRole,
      permissions: { ...role.permissions },
    });
  };

  const closeForm = () => {
    if (isSaving) return;
    setDraft(null);
    setEditingId(null);
    setShowErrors(false);
  };

  const onSubmit = () => {
    if (!draft || isSaving) return;

    if (hasErrors) {
      setShowErrors(true);
      return;
    }

    const payload = {
      label: draft.label.trim(),
      authRole: draft.authRole,
      permissions: draft.permissions,
    };

    const onSuccess = () => {
      setDraft(null);
      setEditingId(null);
      setShowErrors(false);
    };

    if (editing) {
      updateRole.mutate(
        {
          roleId: editing.id,
          // A built-in role's access level cannot move, and sending it would be
          // refused rather than ignored.
          payload: editing.isSystem
            ? { label: payload.label, permissions: payload.permissions }
            : payload,
        },
        { onSuccess },
      );
      return;
    }

    createRole.mutate(payload, { onSuccess });
  };

  const onConfirmDelete = () => {
    if (!pendingDelete || deleteRole.isPending) return;

    deleteRole.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
    });
  };

  const formError = editing
    ? updateRole.isError
      ? message(updateRole.error, 'Something went wrong saving this role. Please try again.')
      : null
    : createRole.isError
      ? message(createRole.error, 'Something went wrong creating this role. Please try again.')
      : null;

  const deleteError = deleteRole.isError
    ? message(deleteRole.error, 'Something went wrong deleting this role. Please try again.')
    : null;

  return (
    <section className="flex w-full flex-col gap-4 md:gap-5">
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-h5 text-text">Roles</h2>
          <p className="text-small text-text-secondary">
            What each role can reach. Editing a role updates everyone who holds
            it, except where a permission was set for one member individually.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={roles.isPending || roles.isError}
          className="flex h-input w-full shrink-0 items-center justify-center gap-2 rounded-control border border-gray-300 bg-white px-5 text-button text-text transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:w-auto"
        >
          <Plus className="size-[1.125rem] shrink-0" strokeWidth={2} aria-hidden="true" />
          Create role
        </button>
      </div>

      {roles.isPending ? (
        <div
          className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-hidden="true"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-[9.5rem] animate-pulse rounded-card bg-gray-200" />
          ))}
        </div>
      ) : roles.isError ? (
        <DataErrorState
          title="We couldn’t load your roles"
          description="Something went wrong fetching the role list. Try again."
          onRetry={() => void roles.refetch()}
          isRetrying={roles.isFetching}
        />
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.data.roles.map((role) => (
            <article
              key={role.id}
              className="flex w-full flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-5"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="min-w-0 text-body font-semibold text-text">
                    {role.label}
                  </h3>

                  {role.isSystem ? (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-caption font-semibold uppercase tracking-[0.6px] text-gray-500">
                      Built-in
                    </span>
                  ) : null}
                </div>

                <p className="flex items-center gap-1.5 text-small text-text-secondary">
                  <Users className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
                  {role.memberCount === 1
                    ? '1 team member'
                    : `${role.memberCount} team members`}
                </p>
              </div>

              {/*
               * The line that matters most on this card. An administrator role
               * reaches everything whatever its grid says, so summarising it as
               * "9 of 15 sections" would be actively wrong.
               */}
              <p className="flex items-start gap-1.5 text-small text-text-secondary">
                <ShieldCheck
                  className={`mt-0.5 size-4 shrink-0 ${role.grantsFullAccess ? 'text-warning' : 'text-gray-400'}`}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {role.grantsFullAccess
                  ? 'Administrator — reaches every section'
                  : `${grantedAreaCount(role, areas)} of ${areas.length} sections`}
              </p>

              <div className="mt-auto flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openEdit(role)}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-control border border-gray-300 bg-white px-3 text-small font-semibold text-text transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  Edit
                </button>

                {/*
                 * Hidden rather than disabled when the role cannot go: a dead
                 * button on a built-in role would be a control that is never
                 * usable, which Design.md asks to be explained or removed. The
                 * reason is printed instead where there is one worth acting on.
                 */}
                {role.canDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteRole.reset();
                      setPendingDelete(role);
                    }}
                    aria-label={`Delete ${role.label}`}
                    className="flex size-9 items-center justify-center rounded-control border border-error/30 bg-white text-error transition-colors hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : !role.isSystem && role.memberCount > 0 ? (
                  <span className="text-small text-gray-400">
                    In use — cannot delete
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <RoleFormDialog
        open={draft !== null}
        editing={editing}
        draft={draft}
        areas={areas}
        authRoleOptions={roles.data?.authRoleOptions ?? []}
        errors={showErrors ? errors : {}}
        isSaving={isSaving}
        error={formError}
        onChange={(next) => setDraft((prev) => (prev ? { ...prev, ...next } : prev))}
        onPermissionChange={(key, granted) =>
          setDraft((prev) =>
            prev ? { ...prev, permissions: { ...prev.permissions, [key]: granted } } : prev,
          )
        }
        onClose={closeForm}
        onSubmit={onSubmit}
      />

      <DeleteRoleDialog
        role={pendingDelete}
        isDeleting={deleteRole.isPending}
        error={deleteError}
        onCancel={() => {
          if (deleteRole.isPending) return;
          deleteRole.reset();
          setPendingDelete(null);
        }}
        onConfirm={onConfirmDelete}
      />
    </section>
  );
}
