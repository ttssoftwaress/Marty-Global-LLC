import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '@/services/api';
import { AdminLayout } from '../components/AdminLayout';
import {
  AccountDetailsCard,
  EditMemberFooter,
  EditMemberHeader,
  RolePermissionsCard,
  useAdminTeamMember,
  useUpdateTeamMember,
} from '../features/team';
import { useAdminShell } from '../hooks/useAdminShell';
import {
  draftFromMember,
  isDraftDirty,
  payloadFromDraft,
  validateMemberDraft,
} from '../lib/team-member-edit';
import type { TeamMemberEditDraft } from '../types/team-member-edit';

/*
 * Edit team member — the admin screen for one staff account: their details,
 * whether the account is enabled, the role they hold, and their per-area access.
 *
 * The section order is the same at every width — header, account details, role
 * & permissions, then the actions — so one tree covers all three links. What
 * changes around it:
 *   - desktop (lg): the content is a centred 840px column; name and email share
 *     a row; the permission areas run one per line; Cancel is bare text beside
 *     Save at the end of the page
 *   - tablet (md):  full-width content; the fields still share a row, but the
 *     permission areas split into two columns filled top-to-bottom, and Cancel
 *     becomes an outlined button
 *   - mobile:       a back row replaces the crumb trail, the fields stack, the
 *     areas return to one column, and the actions pin to a bottom bar
 *
 * Every value on the page comes from `GET /v1/admin/team/:memberId` (endpoint
 * lands later, AGENTS.md two-apps sync rule) — the role options and the
 * permission areas included, so adding an admin section or a role is a backend
 * change rather than a frontend deploy. Nothing here is hardcoded business data.
 *
 * Save is enabled only when the draft actually differs from what loaded, so the
 * button reflects whether there is anything to write.
 */

const TEAM_ROUTE = '/admin/team';

export function AdminTeamMemberEditPage() {
  const { user, onLogout } = useAdminShell();
  const { memberId = '' } = useParams<{ memberId: string }>();

  const member = useAdminTeamMember(memberId || null);
  const updateMember = useUpdateTeamMember();

  const [draft, setDraft] = useState<TeamMemberEditDraft | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  /*
   * Seed the draft once the record has landed. Keyed on the loaded record, so a
   * refetch returning the same data does not discard edits in progress, but
   * navigating to a different member re-seeds.
   */
  const loadedMember = member.data;

  useEffect(() => {
    if (!loadedMember) return;
    setDraft(draftFromMember(loadedMember));
    setShowErrors(false);
  }, [loadedMember]);

  const errors = useMemo(
    () => (draft ? validateMemberDraft(draft) : {}),
    [draft],
  );
  const hasErrors = Object.keys(errors).length > 0;

  // Only surface messages after a save attempt — a form that flags every field
  // the moment it opens reads as broken rather than helpful.
  const visibleErrors = showErrors ? errors : {};

  const isDirty = useMemo(
    () => (draft && loadedMember ? isDraftDirty(draft, loadedMember) : false),
    [draft, loadedMember],
  );

  const patch = (next: Partial<TeamMemberEditDraft>) =>
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));

  const setPermission = (key: string, granted: boolean) =>
    setDraft((prev) =>
      prev ? { ...prev, permissions: { ...prev.permissions, [key]: granted } } : prev,
    );

  /*
   * Switching role re-applies that role's defaults server-side, so the client
   * sends the role it picked and renders whatever access comes back rather than
   * guessing the defaults itself — the permission switches below are the
   * per-member overrides on top of that.
   */
  const setRole = (role: string) => patch({ role });

  const onSave = () => {
    if (!draft || !memberId || updateMember.isPending) return;

    if (hasErrors) {
      setShowErrors(true);
      return;
    }

    updateMember.mutate({ memberId, payload: payloadFromDraft(draft) });
  };

  const saveError = updateMember.isError
    ? updateMember.error instanceof ApiError
      ? updateMember.error.message
      : 'Something went wrong saving this member. Please try again.'
    : null;

  const isLoading = member.isPending || !draft;

  // A member that does not exist (or that the API refused) has nothing to edit —
  // say so rather than rendering an empty form over a failed fetch.
  if (member.isError) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <div className="w-full p-4 md:p-6 lg:p-content">
          <div className="mx-auto flex w-full max-w-[840px] flex-col gap-6">
            <EditMemberHeader />
            <p className="rounded-card border border-gray-200 bg-white p-card text-body text-gray-500">
              This team member could not be loaded. They may have been removed
              from the team.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      {/* The mobile action bar overlays the page, so the bottom padding keeps the
          last card clear of it; `md` and up have no bar to clear. */}
      <div className="w-full p-4 pb-[110px] md:p-6 md:pb-6 lg:p-content">
        {/* Desktop centres the content in an 840px column; tablet and mobile run
            it full width inside the shell's padding. */}
        <div className="mx-auto flex w-full max-w-[840px] flex-col gap-6 lg:gap-8">
          {isLoading ? (
            <EditMemberSkeleton />
          ) : (
            <>
              <EditMemberHeader />

              <AccountDetailsCard
                name={draft.name}
                email={draft.email}
                isActive={draft.isActive}
                statusDescription={loadedMember?.statusDescription ?? ''}
                errors={visibleErrors}
                onNameChange={(name) => patch({ name })}
                onEmailChange={(email) => patch({ email })}
                onActiveChange={(isActive) => patch({ isActive })}
              />

              <RolePermissionsCard
                role={draft.role}
                roles={loadedMember?.roles ?? []}
                areas={loadedMember?.permissionAreas ?? []}
                permissions={draft.permissions}
                onRoleChange={setRole}
                onPermissionChange={setPermission}
              />

              {showErrors && hasErrors ? (
                <p
                  role="alert"
                  className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
                >
                  Some fields need attention before this member can be saved.
                </p>
              ) : null}

              {saveError ? (
                <p
                  role="alert"
                  className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
                >
                  {saveError}
                </p>
              ) : null}

              {updateMember.isSuccess && !isDirty ? (
                <p
                  role="status"
                  className="rounded-input border border-success/30 bg-success/5 px-4 py-3 text-small text-success"
                >
                  Changes saved.
                </p>
              ) : null}

              <EditMemberFooter
                cancelTo={TEAM_ROUTE}
                canSave={isDirty}
                isSaving={updateMember.isPending}
                onSave={onSave}
              />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function EditMemberSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 lg:gap-8" aria-hidden="true">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-[220px] animate-pulse rounded bg-gray-200" />
        <div className="h-9 w-[280px] animate-pulse rounded bg-gray-200" />
      </div>
      {[220, 620].map((height, index) => (
        <div
          key={index}
          style={{ height }}
          className="w-full animate-pulse rounded-card bg-gray-200"
        />
      ))}
    </div>
  );
}
