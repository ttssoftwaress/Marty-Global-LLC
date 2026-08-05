import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '@/services/api';
import { AdminLayout } from '../components/AdminLayout';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { DataErrorState } from '../components/DataErrorState';
import { FormDialog } from '../components/FormDialog';
import { SelectionBar } from '../components/SelectionBar';
import {
  AddStaffForm,
  DeleteStaffDialog,
  TeamCardList,
  TeamEmptyState,
  TeamHeader,
  TeamKpiCards,
  TeamLoadMore,
  TeamPagination,
  TeamRoleFilter,
  TeamSearch,
  TeamStatusTabs,
  TeamTable,
  useAdminTeam,
  useAdminTeamSummary,
  useCreateTeamMember,
  useDeleteTeamMember,
  useUpdateTeamMember,
} from '../features/team';
import { RolesPanel } from '../features/roles';
import { useBulkDelete } from '../features/trash';
import { useAdminShell } from '../hooks/useAdminShell';
import { useCursorPageWindow } from '../hooks/useCursorPageWindow';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  emptyCreateDraft,
  payloadFromCreateDraft,
  permissionsFromRole,
  validateMemberDraft,
} from '../lib/team-member-edit';
import type { AdminTeamMemberRow, TeamStatusFilter } from '../types/team';
import { ALL_ROLES } from '../types/team';
import type { TeamMemberCreateDraft } from '../types/team-member-edit';

/*
 * Team & staff — the admin screen for the internal team, their roles, and their
 * access.
 *
 * The section order is the same at every width — header, KPI cards, controls,
 * then the list — so one tree covers all three links. What changes is how the
 * controls lay out and how the list is drawn:
 *   - desktop (lg): search and the role dropdown sit left, the status pills
 *     right, all on one row; the list is a six-column table in a bordered card
 *   - tablet (md):  search takes the full width on its own row, with the role
 *     dropdown and the pills sharing the next; the table narrows to four columns
 *   - mobile:       search, role, and the pills each take a row, and the list
 *     becomes a stack of cards on the page background with no frame around them
 *
 * Every figure and row comes from the API; nothing on this page is hardcoded
 * business data. Two queries back it: the summary for the three KPI cards, the
 * tabs, and the role options, and an infinite query for the list. Status, role,
 * and search are all query params the backend resolves, so a page always agrees
 * with the total printed beside it.
 *
 * Pagination is one cursor stream shown two ways (AGENTS.md): mobile's "Load
 * more" appends the next page, while the wider links' numbered pager steps a
 * window over what has loaded, fetching ahead when the window runs past the
 * loaded edge.
 *
 * Three write paths run from this screen. "Add staff member" opens a dialog that
 * creates the login outright — there is no invitation to accept, so the account
 * works the moment it exists. The row's status action flips the member between
 * active and deactivated, and Delete removes the account behind a confirmation.
 * Edit navigates to `/admin/team/:memberId/edit` for the full record.
 */

const PAGE_SIZE = 7;
const SEARCH_DEBOUNCE_MS = 300;

function TeamSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 md:gap-0" aria-hidden="true">
      {/* Mobile — a stack of cards */}
      <div className="flex flex-col gap-4 md:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-[10.25rem] animate-pulse rounded-card bg-gray-200"
          />
        ))}
      </div>

      {/* Tablet & desktop — the table frame */}
      <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
        <div className="h-12 w-full border-b border-gray-200 bg-[var(--table-header-bg)]" />
        {Array.from({ length: PAGE_SIZE }, (_, index) => (
          <div
            key={index}
            className="flex h-table-row items-center border-b border-gray-200 px-5 last:border-b-0 lg:px-card"
          >
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminTeamStaffPage() {
  const { user, onLogout } = useAdminShell();
  const navigate = useNavigate();

  const [status, setStatus] = useState<TeamStatusFilter>('all');
  const [role, setRole] = useState<string>(ALL_ROLES);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const summary = useAdminTeamSummary();
  const team = useAdminTeam({ status, role, search: debouncedSearch });

  const loadedMembers = useMemo<AdminTeamMemberRow[]>(
    () => team.data?.pages.flatMap((page) => page.members) ?? [],
    [team.data],
  );

  const totalResults = team.data?.pages[0]?.totalResults ?? 0;
  const totalPages = team.data?.pages[0]?.totalPages ?? 1;

  // The table shows one window; the mobile cards show everything loaded.
  const {
    page,
    rows: windowMembers,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useCursorPageWindow({
    rows: loadedMembers,
    totalPages,
    totalResults,
    pageSize: PAGE_SIZE,
    hasNextPage: team.hasNextPage,
    isFetchingNextPage: team.isFetchingNextPage,
    fetchNextPage: team.fetchNextPage,
    resetKey: `${status}|${role}|${debouncedSearch}`,
  });

  /*
   * Removing several staff accounts at once. `useBulkDelete` gates the tick
   * column on `data.delete`, and the backend narrows further to an administrator
   * for this entity — so a staff member with the grant still gets nothing here,
   * which is why the bar and the column only appear once the delete would
   * actually succeed.
   *
   * The three refusals are the backend's and are shown in the dialog: you cannot
   * delete your own account, you cannot remove the last active admin, and an
   * account that owns customer records is revoked rather than removed.
   */
  const bulk = useBulkDelete({
    entityType: 'staff-member',
    visibleIds: windowMembers.map((member) => member.id),
    resetKey: `${status}|${role}|${debouncedSearch}|${page}`,
  });

  const onLoadMore = () => {
    if (team.hasNextPage) void team.fetchNextPage();
  };

  const clearFilters = () => {
    setStatus('all');
    setRole(ALL_ROLES);
    setSearch('');
  };

  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const deleteMember = useDeleteTeamMember();

  /*
   * The add-staff dialog. The draft is held here rather than in the dialog so
   * closing and reopening starts clean, and so a failed create keeps what was
   * typed instead of making the admin re-enter a password.
   */
  const [addDraft, setAddDraft] = useState<TeamMemberCreateDraft | null>(null);
  const [showAddErrors, setShowAddErrors] = useState(false);

  const addErrors = useMemo(
    () =>
      addDraft
        ? validateMemberDraft(addDraft, { requirePassword: true })
        : {},
    [addDraft],
  );
  const hasAddErrors = Object.keys(addErrors).length > 0;

  const [pendingDelete, setPendingDelete] = useState<AdminTeamMemberRow | null>(
    null,
  );

  const onEdit = (member: AdminTeamMemberRow) =>
    navigate(`/admin/team/${member.id}/edit`);

  /*
   * The role list is the summary's, minus its leading "All roles" filter entry —
   * that value is a query param, not a role an account can hold. The first real
   * option seeds the draft so the select always opens on something valid.
   */
  const assignableRoles = useMemo(
    () => summary.data?.roles.filter((option) => option.value !== ALL_ROLES) ?? [],
    [summary.data],
  );

  // What the draft's role grants — the baseline the dialog's switches start from
  // and are marked against.
  const addRoleGrants = useMemo(
    () =>
      addDraft ? (summary.data?.rolePermissions[addDraft.role] ?? {}) : {},
    [addDraft, summary.data],
  );

  const onAddStaff = () => {
    const defaultRole = assignableRoles[0]?.value;
    if (!defaultRole) return;

    createMember.reset();
    setAddDraft(
      emptyCreateDraft(
        defaultRole,
        summary.data?.permissionAreas ?? [],
        summary.data?.rolePermissions[defaultRole] ?? {},
      ),
    );
    setShowAddErrors(false);
  };

  /*
   * Picking a role re-seeds the grid from it. The switches are an override on
   * top of the role, so leaving the previous role's grid up would silently
   * record every difference between the two as a decision about this account.
   */
  const onAddRoleChange = (role: string) =>
    setAddDraft((prev) =>
      prev
        ? {
            ...prev,
            role,
            permissions: permissionsFromRole(
              summary.data?.permissionAreas ?? [],
              summary.data?.rolePermissions[role] ?? {},
            ),
          }
        : prev,
    );

  const closeAddDialog = () => {
    if (createMember.isPending) return;
    setAddDraft(null);
    setShowAddErrors(false);
  };

  const onCreate = () => {
    if (!addDraft || createMember.isPending) return;

    if (hasAddErrors) {
      setShowAddErrors(true);
      return;
    }

    createMember.mutate(payloadFromCreateDraft(addDraft), {
      onSuccess: () => {
        setAddDraft(null);
        setShowAddErrors(false);
      },
    });
  };

  /*
   * The row's status action. The list rows do not carry the member's role or
   * permission grid, so the PATCH sends only `isActive` — a partial write, which
   * is what the endpoint expects; the backend leaves everything it does not
   * carry alone.
   */
  const onToggleActive = (member: AdminTeamMemberRow) => {
    if (updateMember.isPending) return;

    updateMember.mutate({
      memberId: member.id,
      payload: { isActive: member.status !== 'active' },
    });
  };

  const onConfirmDelete = () => {
    if (!pendingDelete || deleteMember.isPending) return;

    deleteMember.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
    });
  };

  const closeDeleteDialog = () => {
    if (deleteMember.isPending) return;
    deleteMember.reset();
    setPendingDelete(null);
  };

  // A refused write is the backend's message when it has one — "last active
  // admin", "email already in use" — and a generic line otherwise.
  const errorMessage = (error: unknown, fallback: string) =>
    error instanceof ApiError ? error.message : fallback;

  const createError = createMember.isError
    ? errorMessage(
        createMember.error,
        'Something went wrong creating this account. Please try again.',
      )
    : null;

  const deleteError = deleteMember.isError
    ? errorMessage(
        deleteMember.error,
        'Something went wrong deleting this account. Please try again.',
      )
    : null;

  const toggleError = updateMember.isError
    ? errorMessage(
        updateMember.error,
        'Something went wrong updating this member. Please try again.',
      )
    : null;

  const isFiltered =
    status !== 'all' || role !== ALL_ROLES || Boolean(debouncedSearch.trim());

  /*
   * A failed query is neither pending nor empty. Without this branch a dropped
   * team-list fetch fell through to "No team members yet" — an empty roster is a
   * fact about the company, and reporting one for a network fault is a lie.
   */
  const isError = summary.isError || team.isError;
  const isLoading = !isError && (summary.isPending || team.isPending);
  const isEmpty = !isLoading && !isError && loadedMembers.length === 0;

  const retry = () => {
    if (summary.isError) void summary.refetch();
    if (team.isError) void team.refetch();
  };


  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 pb-8 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4 md:gap-6 lg:gap-8">
          <TeamHeader onAddStaff={onAddStaff} />

          {summary.data ? <TeamKpiCards summary={summary.data} /> : null}

          {/* A refused status change has nowhere else to surface — the row
              action has no form behind it. */}
          {toggleError ? (
            <p
              role="alert"
              className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
            >
              {toggleError}
            </p>
          ) : null}

          {summary.data ? (
            /*
             * Desktop puts search and the role dropdown left with the pills
             * pushed right on one row; tablet gives search its own full-width
             * row with the role and pills sharing the next; mobile stacks all
             * three. One tree covers it — the row only forms at `lg`, and the
             * role/pills pair splits apart below `md`.
             */
            <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <div className="flex w-full flex-col gap-4 lg:w-auto lg:flex-row lg:items-center lg:gap-4">
                <div className="w-full lg:w-[20rem] lg:shrink-0">
                  <TeamSearch value={search} onChange={setSearch} />
                </div>

                <div className="flex w-full items-center justify-between gap-4 md:gap-6 lg:w-auto lg:justify-start">
                  <TeamRoleFilter
                    options={summary.data.roles}
                    value={role}
                    onChange={setRole}
                    className="w-full max-w-[12.5rem] shrink-0 md:w-[10rem] lg:w-[11.25rem] lg:max-w-none"
                  />

                  {/* Tablet keeps the pills beside the dropdown; desktop moves
                      them to the far right of the row, and mobile drops them to
                      their own line. */}
                  <div className="hidden md:flex lg:hidden">
                    <TeamStatusTabs
                      tabs={summary.data.tabs}
                      value={status}
                      onChange={setStatus}
                    />
                  </div>
                </div>

                <div className="md:hidden">
                  <TeamStatusTabs
                    tabs={summary.data.tabs}
                    value={status}
                    onChange={setStatus}
                  />
                </div>
              </div>

              <div className="hidden lg:flex">
                <TeamStatusTabs
                  tabs={summary.data.tabs}
                  value={status}
                  onChange={setStatus}
                />
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <TeamSkeleton />
          ) : isError ? (
            <DataErrorState
              title="We couldn’t load your team"
              description="Something went wrong fetching the team list. Try again."
              onRetry={retry}
              isRetrying={summary.isFetching || team.isFetching}
            />
          ) : (
            <>
              {bulk.canDelete ? (
                <SelectionBar
                  count={bulk.selection.count}
                  noun="staff accounts"
                  singularNoun="staff account"
                  onDelete={bulk.openDialog}
                  onClear={bulk.selection.clear}
                  isDeleting={bulk.isDeleting}
                />
              ) : null}

              {/* Mobile — cards on the page background, no surrounding frame. */}
              {isEmpty ? null : (
                <TeamCardList
                  members={loadedMembers}
                  onEdit={onEdit}
                  onToggleActive={onToggleActive}
                  onDelete={setPendingDelete}
                />
              )}

              {/* Tablet & desktop — the table in its own card. */}
              <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
                {isEmpty ? (
                  <TeamEmptyState
                    isFiltered={isFiltered}
                    onClearFilters={clearFilters}
                  />
                ) : (
                  <TeamTable
                    members={windowMembers}
                    onEdit={onEdit}
                    onToggleActive={onToggleActive}
                    onDelete={setPendingDelete}
                    selection={bulk.selection}
                    selectable={bulk.canDelete}
                  />
                )}
              </div>

              {isEmpty ? (
                <div className="rounded-card border border-gray-200 bg-white md:hidden">
                  <TeamEmptyState
                    isFiltered={isFiltered}
                    onClearFilters={clearFilters}
                  />
                </div>
              ) : (
                <>
                  {/* The pager sits under the table card, not inside it. */}
                  <TeamPagination
                    page={page}
                    totalPages={totalPages}
                    totalResults={totalResults}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onPageChange={goToPage}
                  />

                  <TeamLoadMore
                    totalResults={totalResults}
                    loadedCount={loadedMembers.length}
                    hasMore={Boolean(team.hasNextPage)}
                    isLoadingMore={team.isFetchingNextPage}
                    onLoadMore={onLoadMore}
                  />
                </>
              )}
            </>
          )}

          {/*
           * Roles sit under the members who hold them, on the same screen: an
           * admin reading a role on a member's row can find out what it grants
           * without losing the list. The rule marks it as a second subject rather
           * than more of the table.
           */}
          <hr className="w-full border-t border-gray-200" />

          <RolesPanel />
        </div>
      </div>

      {/* The dialog's own draft is what keeps it mounted, so the sheet animates
          and its focus trap tears down cleanly on close. */}
      <FormDialog
        open={addDraft !== null}
        title="Add staff member"
        description="Create a login for a colleague and choose what they can access."
        size="md"
        onClose={closeAddDialog}
        footer={
          <div className="flex items-center justify-end gap-3 md:gap-4">
            <button
              type="button"
              onClick={closeAddDialog}
              disabled={createMember.isPending}
              className="flex h-input items-center justify-center rounded-control border border-gray-300 bg-white px-5 text-button text-text transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onCreate}
              disabled={createMember.isPending}
              className="flex h-input min-w-0 items-center justify-center rounded-control bg-primary px-5 text-button text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              {createMember.isPending ? 'Creating…' : 'Create account'}
            </button>
          </div>
        }
      >
        {addDraft ? (
          <div className="flex w-full flex-col gap-5">
            <AddStaffForm
              draft={addDraft}
              roles={assignableRoles}
              areas={summary.data?.permissionAreas ?? []}
              roleGrants={addRoleGrants}
              roleGrantsFullAccess={
                summary.data?.fullAccessRoles.includes(addDraft.role) ?? false
              }
              errors={showAddErrors ? addErrors : {}}
              onChange={(next) =>
                next.role !== undefined && next.role !== addDraft.role
                  ? onAddRoleChange(next.role)
                  : setAddDraft((prev) => (prev ? { ...prev, ...next } : prev))
              }
              onPermissionChange={(key, granted) =>
                setAddDraft((prev) =>
                  prev
                    ? { ...prev, permissions: { ...prev.permissions, [key]: granted } }
                    : prev,
                )
              }
            />

            {createError ? (
              <p
                role="alert"
                className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
              >
                {createError}
              </p>
            ) : null}
          </div>
        ) : null}
      </FormDialog>

      <DeleteStaffDialog
        member={pendingDelete}
        isDeleting={deleteMember.isPending}
        error={deleteError}
        onCancel={closeDeleteDialog}
        onConfirm={onConfirmDelete}
      />

      <ConfirmDeleteDialog
        open={bulk.isDialogOpen}
        count={bulk.selection.count}
        singularNoun="staff account"
        pluralNoun="staff accounts"
        retentionDays={bulk.retentionDays}
        isDeleting={bulk.isDeleting}
        error={bulk.error}
        onConfirm={bulk.confirm}
        onClose={bulk.closeDialog}
      />
    </AdminLayout>
  );
}
