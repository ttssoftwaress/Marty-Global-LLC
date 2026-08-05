import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminAuditEntry,
  AdminAuditPage,
  AdminAuditSummary,
} from '../../types/audit';
import { ALL_ACTIONS, ALL_CATEGORIES } from '../../types/audit';

/*
 * Admin audit log data layer.
 *
 * Two queries and no mutations, which is the whole shape of this feature: the
 * trail is written by the backend's recording layer and never edited from a
 * screen. There is no endpoint to write to, so there is nothing to add here.
 *
 * Category, action, search, and the date window are all query params the backend
 * resolves — the UI never filters, sorts, or counts rows client-side, so a page
 * always agrees with the total printed beside it.
 */

export const adminAuditSummaryKey = () => ['admin', 'audit', 'summary'] as const;

/*
 * GET /v1/admin/audit/summary — the three KPI figures, the category tabs, and
 * the action options the dropdown offers.
 *
 * Held briefly rather than indefinitely: two of its three figures are
 * last-24-hours counts that move as the trail grows, so a stale cache would
 * print a "failed sign-ins today" number from whenever the tab was opened.
 */
export function useAdminAuditSummary() {
  return useQuery({
    queryKey: adminAuditSummaryKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminAuditSummary>>('/admin/audit/summary').then(
        (res) => res.data,
      ),
  });
}

export type AdminAuditParams = {
  category: string;
  action: string;
  search: string;
  /*
   * The window, as ISO-8601 instants — inclusive `from`, exclusive `to`. The
   * page builds them from a day boundary in the viewer's own zone, which is why
   * they are resolved here rather than sent as plain dates: the backend must not
   * guess which midnight was meant (AGENTS.md, Dates).
   */
  from: string | null;
  to: string | null;
};

export const adminAuditKey = (params: AdminAuditParams) =>
  [
    'admin',
    'audit',
    'list',
    params.category,
    params.action,
    params.search,
    params.from,
    params.to,
  ] as const;

// GET /v1/admin/audit?category=&action=&search=&from=&to=&cursor=&limit= — one
// page of the trail. The backend owns the filtering and the pagination figures
// the footer prints.
function fetchAdminAuditPage(
  params: AdminAuditParams,
  cursor: string | null,
): Promise<AdminAuditPage> {
  const query = new URLSearchParams({ category: params.category });

  const search = params.search.trim();
  if (search) query.set('search', search);
  // An action is strictly narrower than the category it sits in, so the backend
  // takes it in preference; sending the pass-through value would only widen it.
  if (params.action !== ALL_ACTIONS) query.set('action', params.action);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<AdminAuditPage>>(
    `/admin/audit?${query.toString()}`,
  ).then((res) => res.data);
}

export function useAdminAudit(params: AdminAuditParams) {
  return useInfiniteQuery({
    queryKey: adminAuditKey(params),
    queryFn: ({ pageParam }) => fetchAdminAuditPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keeps the current rows on screen while a tab or filter change loads, so
    // the list does not flash a skeleton on every press.
    placeholderData: (previous) => previous,
  });
}

// The unfiltered starting point, so the page and its "clear filters" action
// agree on what "no filters" means.
export const emptyAuditParams: AdminAuditParams = {
  category: ALL_CATEGORIES,
  action: ALL_ACTIONS,
  search: '',
  from: null,
  to: null,
};

export const adminAuditEntryKey = (id: string) =>
  ['admin', 'audit', 'entry', id] as const;

/*
 * GET /v1/admin/audit/:id — one entry in full, for the expanded row.
 *
 * Called from inside the detail panel, which is only mounted while its row is
 * open, so the request happens on expand rather than on page load: a page of
 * the trail fetches the metadata of the one entry somebody is reading.
 *
 * An audit entry is immutable — nothing in the system can edit or delete one —
 * so once fetched it never goes stale, and re-opening a row is instant.
 */
export function useAdminAuditEntry(id: string) {
  return useQuery({
    queryKey: adminAuditEntryKey(id),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminAuditEntry>>(`/admin/audit/${id}`).then(
        (res) => res.data,
      ),
    staleTime: Infinity,
  });
}
