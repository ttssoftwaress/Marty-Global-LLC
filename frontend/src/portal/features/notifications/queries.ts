import { useInfiniteQuery } from '@tanstack/react-query';

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

export const notificationFeedKey = (filter: NotificationFilter) =>
  ['notifications', 'feed', filter] as const;

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
