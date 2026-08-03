import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminTeamPage,
  AdminTeamSummary,
  TeamStatusFilter,
} from '../../types/team';
import { ALL_ROLES } from '../../types/team';
import type {
  AdminTeamMemberDetail,
  TeamMemberCreatePayload,
  TeamMemberWritePayload,
} from '../../types/team-member-edit';

/*
 * Admin team & staff data layer.
 *
 * Two queries back the list screen:
 *   - the summary: the three KPI figures, the status tabs, and the role options
 *   - the list itself, an infinite query so the design's two pagination shapes
 *     both work over one cursor stream (AGENTS.md, cursor pagination): mobile's
 *     "Load more" appends a page, the wider links' numbered pager steps a window
 *
 * Status, role, and search are all query params the backend resolves — the UI
 * never filters, sorts, or counts rows client-side, so a page always agrees with
 * the total printed beside it.
 *
 * Three mutations write: creating a staff login, editing one, and deleting one.
 * All three shift the KPI figures and move rows between tabs, so each
 * invalidates the list and the summary rather than patching the cache by hand.
 */

export const adminTeamSummaryKey = () => ['admin', 'team', 'summary'] as const;

// GET /v1/admin/team/summary — the three KPI figures, the status tabs, and the
// role options the dropdown offers.
export function useAdminTeamSummary() {
  return useQuery({
    queryKey: adminTeamSummaryKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminTeamSummary>>('/admin/team/summary').then(
        (res) => res.data,
      ),
  });
}

export type AdminTeamParams = {
  status: TeamStatusFilter;
  role: string;
  search: string;
};

export const adminTeamKey = (params: AdminTeamParams) =>
  ['admin', 'team', 'list', params.status, params.role, params.search] as const;

// GET /v1/admin/team?status=&role=&search=&cursor=&limit= — one page of the
// list. The backend owns the filtering and the pagination figures the footer
// prints.
function fetchAdminTeamPage(
  params: AdminTeamParams,
  cursor: string | null,
): Promise<AdminTeamPage> {
  const query = new URLSearchParams({ status: params.status });

  const search = params.search.trim();
  if (search) query.set('search', search);
  if (params.role !== ALL_ROLES) query.set('role', params.role);
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<AdminTeamPage>>(
    `/admin/team?${query.toString()}`,
  ).then((res) => res.data);
}

export function useAdminTeam(params: AdminTeamParams) {
  return useInfiniteQuery({
    queryKey: adminTeamKey(params),
    queryFn: ({ pageParam }) => fetchAdminTeamPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keeps the current rows on screen while a tab or role change loads, so the
    // list does not flash a skeleton on every press.
    placeholderData: (previous) => previous,
  });
}

export const adminTeamMemberKey = (memberId: string) =>
  ['admin', 'team', 'member', memberId] as const;

/*
 * GET /v1/admin/team/:memberId — one member in full for the edit screen: their
 * account details and status, the role they hold, their per-area access, plus
 * the role options and the permission areas the form renders.
 *
 * The list rows carry only what the table columns print, so the editor fetches
 * its own record rather than reading one out of the list cache — a member
 * reached by deep link has no list page behind it.
 */
export function useAdminTeamMember(memberId: string | null) {
  return useQuery({
    queryKey: adminTeamMemberKey(memberId ?? ''),
    enabled: Boolean(memberId),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminTeamMemberDetail>>(
        `/admin/team/${encodeURIComponent(memberId ?? '')}`,
      ).then((res) => res.data),
  });
}

/*
 * PATCH /v1/admin/team/:memberId — the edit screen's save.
 *
 * Changing a member's role or access changes who can act on customer records
 * and money, so the backend audits it (AGENTS.md) and re-derives the effective
 * permissions itself — the client sends what the form holds and trusts the
 * response, never its own optimistic merge. The list and summary are
 * invalidated because a role or status change moves the member between tabs and
 * shifts the KPI figures.
 */
/*
 * POST /v1/admin/team — create a staff login.
 *
 * The admin sets the credential directly; there is no invitation to accept, so
 * the account comes back ready to sign in. The backend hashes the password
 * through Better Auth and re-derives the effective permissions from the role, so
 * the response is what actually got created rather than what the form sent.
 */
export function useCreateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TeamMemberCreatePayload) =>
      apiFetch<ApiSuccess<AdminTeamMemberDetail>>('/admin/team', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: (member) => {
      queryClient.setQueryData(adminTeamMemberKey(member.id), member);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'team', 'list'] });
      void queryClient.invalidateQueries({ queryKey: adminTeamSummaryKey() });
    },
  });
}

/*
 * DELETE /v1/admin/team/:memberId — remove a staff account.
 *
 * The backend deletes the account row itself and drops the member's sessions, so
 * this ends the login rather than only hiding the row. The cached detail record
 * is dropped outright: the member no longer resolves, and a stale entry would
 * let the edit screen render a form over an account that is gone.
 */
export function useDeleteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<ApiSuccess<{ id: string }>>(
        `/admin/team/${encodeURIComponent(memberId)}`,
        { method: 'DELETE' },
      ).then((res) => res.data),
    onSuccess: ({ id }) => {
      queryClient.removeQueries({ queryKey: adminTeamMemberKey(id) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'team', 'list'] });
      void queryClient.invalidateQueries({ queryKey: adminTeamSummaryKey() });
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      payload,
    }: {
      memberId: string;
      payload: TeamMemberWritePayload;
    }) =>
      apiFetch<ApiSuccess<AdminTeamMemberDetail>>(
        `/admin/team/${encodeURIComponent(memberId)}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: (member) => {
      queryClient.setQueryData(adminTeamMemberKey(member.id), member);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'team', 'list'] });
      void queryClient.invalidateQueries({ queryKey: adminTeamSummaryKey() });
    },
  });
}
