import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AdminLayout } from '../components/AdminLayout';
import {
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
} from '../features/team';
import { useAdminShell } from '../hooks/useAdminShell';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { AdminTeamMemberRow, TeamStatusFilter } from '../types/team';
import { ALL_ROLES } from '../types/team';

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
 * business data. Two queries back it (endpoints land later): the summary for the
 * three KPI cards, the tabs, and the role options, and an infinite query for the
 * list. Status, role, and search are all query params the backend resolves, so a
 * page always agrees with the total printed beside it.
 *
 * Pagination is one cursor stream shown two ways (AGENTS.md): mobile's "Load
 * more" appends the next page, while the wider links' numbered pager steps a
 * window over what has loaded, fetching ahead when the window runs past the
 * loaded edge.
 *
 * The row actions (invite, edit, deactivate/reactivate, resend) are the screen's
 * write paths; their mutations land with the backend module. They are wired to
 * named handlers here rather than left inert, so the endpoints drop into one
 * place when they arrive.
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
            className="h-[164px] animate-pulse rounded-card bg-gray-200"
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

  // The page window the wider links' pager steps over. Any change to the result
  // set returns it to the first page, since the old offset means nothing now.
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
  }, [status, role, debouncedSearch]);

  const loadedMembers = useMemo<AdminTeamMemberRow[]>(
    () => team.data?.pages.flatMap((page) => page.members) ?? [],
    [team.data],
  );

  const totalResults = team.data?.pages[0]?.totalResults ?? 0;
  const totalPages = team.data?.pages[0]?.totalPages ?? 1;

  // The table shows one window; the mobile cards show everything loaded.
  const windowMembers = useMemo(
    () => loadedMembers.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [loadedMembers, pageIndex],
  );

  const goToPage = (nextPage: number) => {
    const nextIndex = Math.max(0, Math.min(nextPage - 1, totalPages - 1));
    // Pull the next cursor page in when the window runs past what has loaded.
    if (nextIndex * PAGE_SIZE >= loadedMembers.length && team.hasNextPage) {
      void team.fetchNextPage();
    }
    setPageIndex(nextIndex);
  };

  const onLoadMore = () => {
    if (team.hasNextPage) void team.fetchNextPage();
  };

  const clearFilters = () => {
    setStatus('all');
    setRole(ALL_ROLES);
    setSearch('');
  };

  /*
   * The screen's write paths. Edit opens the member editor at
   * `/admin/team/:memberId/edit`; the rest are backend mutations that do not
   * exist yet (AGENTS.md, two-apps sync rule) — an invite form and the
   * status/resend endpoints land with the `team` module. Keeping them as named
   * no-op handlers rather than inert markup means the controls are already real
   * buttons with the right accessible names and focus behaviour, and the
   * endpoints drop into one place.
   */
  const onInvite = () => {};
  const onEdit = (member: AdminTeamMemberRow) =>
    navigate(`/admin/team/${member.id}/edit`);
  const onToggleActive = (_member: AdminTeamMemberRow) => {};
  const onResendInvite = (_member: AdminTeamMemberRow) => {};

  const isFiltered =
    status !== 'all' || role !== ALL_ROLES || Boolean(debouncedSearch.trim());

  const isLoading = summary.isPending || team.isPending;
  const isEmpty = !isLoading && loadedMembers.length === 0;

  const rangeStart = totalResults === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const rangeEnd = pageIndex * PAGE_SIZE + windowMembers.length;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 pb-8 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 md:gap-6 lg:gap-8">
          <TeamHeader onInvite={onInvite} />

          {summary.data ? <TeamKpiCards summary={summary.data} /> : null}

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
                <div className="w-full lg:w-[320px] lg:shrink-0">
                  <TeamSearch value={search} onChange={setSearch} />
                </div>

                <div className="flex w-full items-center justify-between gap-4 md:gap-6 lg:w-auto lg:justify-start">
                  <TeamRoleFilter
                    options={summary.data.roles}
                    value={role}
                    onChange={setRole}
                    className="w-full max-w-[200px] shrink-0 md:w-[160px] lg:w-[180px] lg:max-w-none"
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
          ) : (
            <>
              {/* Mobile — cards on the page background, no surrounding frame. */}
              {isEmpty ? null : (
                <TeamCardList
                  members={loadedMembers}
                  onEdit={onEdit}
                  onToggleActive={onToggleActive}
                  onResendInvite={onResendInvite}
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
                    onResendInvite={onResendInvite}
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
                    page={pageIndex + 1}
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
        </div>
      </div>
    </AdminLayout>
  );
}
