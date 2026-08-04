import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  NotificationFeedPage,
  NotificationFilter,
} from '../../types/notifications';

/*
 * The full-page notification feed (`/app/notifications`). It is an infinite
 * query so the design's "Load older notifications" button appends the next
 * (older) page over one cursor stream (AGENTS.md, cursor pagination). The
 * top-bar panel reads a separate, smaller feed; this is the paginated screen.
 *
 * The active filter is part of the query key, so switching tabs is its own
 * cached stream and the server does the filtering — the client never slices a
 * partially-loaded feed and mislabels a count. The backend scopes everything to
 * the signed-in customer.
 */

// Exported so the shell's live-badge hook invalidates exactly this subtree
// rather than re-declaring the same literal beside it.
export const ROOT_KEY = ['notifications'] as const;

export const notificationFeedKey = (filter: NotificationFilter) =>
  [...ROOT_KEY, 'feed', filter] as const;

// GET /v1/notifications?filter=&cursor=&limit= — one page of the customer's
// feed. The backend resolves the filter, the per-row date group, the unread
// count, and pagination.
function fetchNotificationFeedPage(
  filter: NotificationFilter,
  cursor: string | null,
): Promise<NotificationFeedPage> {
  const query = new URLSearchParams({ filter });
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<NotificationFeedPage>>(
    `/notifications?${query.toString()}`,
  ).then((res) => res.data);
}

export function useNotificationFeed(filter: NotificationFilter) {
  return useInfiniteQuery({
    queryKey: notificationFeedKey(filter),
    queryFn: ({ pageParam }) => fetchNotificationFeedPage(filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep the previous tab's rows on screen while the next filter loads, so
    // switching tabs doesn't flash the skeleton.
    placeholderData: (previous) => previous,
  });
}

/*
 * The top-bar panel reads the same endpoint as the page, just the newest few
 * rows — it shows what still needs attention, not a paginated stream, so it is a
 * plain query rather than an infinite one. `unreadCount` off the same response
 * backs the bell's badge, so the badge and the panel can never disagree.
 *
 * It asks for `filter=unread` on purpose: the panel is the bell's contents, and
 * the bell claims a count of unread rows. A read row lingering under it made the
 * panel disagree with its own badge and pushed the rows that do need attention
 * out of the eight. Marking a row read (or all of them) therefore empties it —
 * the full history stays one click away at `/app/notifications`.
 */

const PANEL_LIMIT = 8;

export const notificationPanelKey = () => [...ROOT_KEY, 'panel'] as const;

// GET /v1/notifications?filter=unread&limit=
export function useNotificationPanel() {
  return useQuery({
    queryKey: notificationPanelKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<NotificationFeedPage>>(
        `/notifications?filter=unread&limit=${PANEL_LIMIT}`,
      ).then((res) => res.data),
  });
}

// Both mutations invalidate every notification stream — the panel, the badge,
// and each filter tab's cached feed all read the same rows, so one write has to
// refresh all of them rather than just the caller's view.
function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ROOT_KEY });
}

// POST /v1/notifications/read-all — the panel's "Mark all as read".
export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();

  return useMutation({
    mutationFn: () =>
      apiFetch<ApiSuccess<{ unreadCount: number }>>('/notifications/read-all', {
        method: 'POST',
      }).then((res) => res.data),
    onSuccess: invalidate,
  });
}

// POST /v1/notifications/:id/read — a row click, before it navigates to `href`.
export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiSuccess<{ id: string; read: true }>>(
        `/notifications/${id}/read`,
        { method: 'POST' },
      ).then((res) => res.data),
    onSuccess: invalidate,
  });
}
