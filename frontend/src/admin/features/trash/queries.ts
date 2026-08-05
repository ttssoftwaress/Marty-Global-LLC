import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  TrashDeleteResult,
  TrashEntityKey,
  TrashPage,
  TrashPurgeResult,
  TrashRestoreResult,
  TrashSettings,
  TrashSummary,
} from '../../types/trash';
import { ALL_TRASH_TYPES } from '../../types/trash';

/*
 * Trash & restore data layer, and the delete every admin table calls.
 *
 * `useDeleteRows` deliberately lives here rather than in each list's own
 * `queries.ts`: there is one delete endpoint, one set of rules behind it, and one
 * bin the rows land in, so a per-feature copy would only be a second place to
 * forget an invalidation. What each table supplies is its entity key and the
 * rows it selected.
 *
 * INVALIDATION IS BROAD ON PURPOSE. A delete cascades — removing a customer
 * touches orders, quotes, payments, mail rooms, and conversations — so scoping
 * the invalidation to the list that issued it would leave five other screens
 * showing rows that are already gone. Every admin query is dropped instead.
 * These are small, fast lists behind a deliberate click, and a stale screen
 * after a destructive action is a worse trade than a refetch.
 */

// --- Keys ----------------------------------------------------------------

export const adminTrashSummaryKey = () => ['admin', 'trash', 'summary'] as const;
export const adminTrashSettingsKey = () => ['admin', 'trash', 'settings'] as const;

export type AdminTrashParams = { entityType: string; search: string };

export const adminTrashKey = (params: AdminTrashParams) =>
  ['admin', 'trash', 'list', params.entityType, params.search] as const;

function invalidateEverything(queryClient: ReturnType<typeof useQueryClient>) {
  // See the note above — a cascade can touch any admin list, so nothing narrower
  // than the whole namespace is honest.
  void queryClient.invalidateQueries({ queryKey: ['admin'] });
}

// --- The delete ----------------------------------------------------------

export type DeleteRowsInput = {
  entityType: TrashEntityKey;
  ids: string[];
};

/*
 * POST /v1/admin/deletions — move rows to the Trash.
 *
 * The one delete in the admin portal. It soft-deletes the rows, takes whatever
 * would otherwise be left pointing at them, and files a restorable entry per
 * row; nothing is destroyed until the retention window closes.
 *
 * A refusal comes back as a 422 with a sentence written for the admin (the last
 * admin account, a service on a customer's order, a location an order was filed
 * under). Callers render `error.message` as-is — the copy is the backend's,
 * because that is the layer that knows why.
 */
export function useDeleteRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteRowsInput) =>
      apiFetch<ApiSuccess<TrashDeleteResult>>('/admin/deletions', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((res) => res.data),
    onSuccess: () => invalidateEverything(queryClient),
  });
}

// --- The bin -------------------------------------------------------------

/*
 * GET /v1/admin/trash/summary — the KPI figures, the retention window, and the
 * type filter's options.
 *
 * Not held: every delete and restore changes it, and the counts sit beside the
 * buttons that change them.
 */
export function useAdminTrashSummary() {
  return useQuery({
    queryKey: adminTrashSummaryKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<TrashSummary>>('/admin/trash/summary').then(
        (res) => res.data,
      ),
  });
}

// GET /v1/admin/trash?entityType=&search=&cursor= — one page of the bin. The
// backend owns the filtering, the scoping, and the figures the footer prints.
function fetchTrashPage(
  params: AdminTrashParams,
  cursor: string | null,
): Promise<TrashPage> {
  const query = new URLSearchParams();

  if (params.entityType !== ALL_TRASH_TYPES) query.set('entityType', params.entityType);

  const search = params.search.trim();
  if (search) query.set('search', search);
  if (cursor) query.set('cursor', cursor);

  const suffix = query.toString();

  return apiFetch<ApiSuccess<TrashPage>>(
    `/admin/trash${suffix ? `?${suffix}` : ''}`,
  ).then((res) => res.data);
}

export function useAdminTrash(params: AdminTrashParams) {
  return useInfiniteQuery({
    queryKey: adminTrashKey(params),
    queryFn: ({ pageParam }) => fetchTrashPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keeps the rows on screen while a filter change loads, so the list does not
    // flash a skeleton on every press.
    placeholderData: (previous) => previous,
  });
}

/*
 * POST /v1/admin/trash/restore — the undo.
 *
 * Puts back exactly what each entry's delete took, and nothing else: a row that
 * was already in the bin beforehand stays there. The entry is removed on
 * success, which is what makes a double-clicked restore a no-op.
 */
export function useRestoreEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<ApiSuccess<TrashRestoreResult>>('/admin/trash/restore', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }).then((res) => res.data),
    onSuccess: () => invalidateEverything(queryClient),
  });
}

/*
 * POST /v1/admin/trash/purge — empty the bin ahead of its window.
 *
 * The only irreversible action in the feature, and admin-only on the route. A
 * POST rather than a DELETE because it carries a body of ids, which is the shape
 * proxies and fetch implementations are least reliable about on a DELETE.
 *
 * `kept` in the result is not a failure — it counts rows a rule says must stay
 * (a staff account owning customer records, a bank account money came in on).
 * They remain in the bin with the reason printed on them.
 */
export function usePurgeEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<ApiSuccess<TrashPurgeResult>>('/admin/trash/purge', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }).then((res) => res.data),
    onSuccess: () => invalidateEverything(queryClient),
  });
}

// --- Retention -----------------------------------------------------------

// GET /v1/admin/trash/settings — how long a deletion stays reversible, and
// whether the nightly sweep destroys anything at all.
export function useTrashSettings() {
  return useQuery({
    queryKey: adminTrashSettingsKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<TrashSettings>>('/admin/trash/settings').then(
        (res) => res.data,
      ),
  });
}

/*
 * PATCH /v1/admin/trash/settings — admin-only.
 *
 * Applies to entries created after the change. Existing entries keep the
 * deadline they were given, so shortening the window never retroactively
 * destroys something an admin was told they had thirty days to recover.
 */
export function useUpdateTrashSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<TrashSettings>) =>
      apiFetch<ApiSuccess<TrashSettings>>('/admin/trash/settings', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(adminTrashSettingsKey(), data);
      void queryClient.invalidateQueries({ queryKey: adminTrashSummaryKey() });
    },
  });
}
