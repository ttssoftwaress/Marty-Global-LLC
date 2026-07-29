import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminNotificationFeedPage,
  AdminNotificationFilter,
} from '../../types/notifications';

/*
 * Server state for the staff notification feed — `GET /admin/notifications` and
 * its two mark-read writes.
 *
 * Two readers share the endpoint: the full page pages through it with a cursor,
 * and the top-bar panel takes a short unfiltered slice. They are separate query
 * keys so opening the panel never disturbs the page's paginated cache, and both
 * live under the `['admin','notifications']` prefix so one invalidation after a
 * write refreshes the panel, the badge, and every filter tab together.
 */

// Exported so the shell's live-badge hook invalidates exactly this subtree
// rather than re-declaring the same literal beside it.
export const ROOT_KEY = ['admin', 'notifications'] as const;

export const adminNotificationFeedKey = (filter: AdminNotificationFilter) =>
  [...ROOT_KEY, 'feed', filter] as const;

export const adminNotificationPanelKey = () => [...ROOT_KEY, 'panel'] as const;

// The panel shows a short slice; the page asks for the server's default of 20.
const PANEL_LIMIT = 8;

function fetchFeedPage(
  filter: AdminNotificationFilter,
  cursor: string | null,
): Promise<AdminNotificationFeedPage> {
  const query = new URLSearchParams({ filter });
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<AdminNotificationFeedPage>>(
    `/admin/notifications?${query.toString()}`,
  ).then((res) => res.data);
}

export function useAdminNotificationFeed(filter: AdminNotificationFilter) {
  return useInfiniteQuery({
    queryKey: adminNotificationFeedKey(filter),
    queryFn: ({ pageParam }) => fetchFeedPage(filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep the previous tab's rows on screen while the next loads, so switching
    // filters doesn't flash a skeleton over an already-populated list.
    placeholderData: (previous) => previous,
  });
}

/*
 * The top-bar panel's feed. Mounted in the admin shell, so it runs on every
 * `/admin/*` screen — which is also what feeds the bell's unread badge.
 */
export function useAdminNotificationPanel() {
  return useQuery({
    queryKey: adminNotificationPanelKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminNotificationFeedPage>>(
        `/admin/notifications?filter=all&limit=${PANEL_LIMIT}`,
      ).then((res) => res.data),
  });
}

function useInvalidateAdminNotifications() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ROOT_KEY });
  };
}

export function useMarkAllAdminNotificationsRead() {
  const invalidate = useInvalidateAdminNotifications();

  return useMutation({
    mutationFn: () =>
      apiFetch<ApiSuccess<{ unreadCount: number }>>(
        '/admin/notifications/read-all',
        { method: 'POST' },
      ).then((res) => res.data),
    onSuccess: invalidate,
  });
}

export function useMarkAdminNotificationRead() {
  const invalidate = useInvalidateAdminNotifications();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiSuccess<{ id: string; read: true }>>(
        `/admin/notifications/${id}/read`,
        { method: 'POST' },
      ).then((res) => res.data),
    onSuccess: invalidate,
  });
}
