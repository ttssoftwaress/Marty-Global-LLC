import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import { SocketEvent, type SocketUnread } from '@/services/socket';

/*
 * The live unread counters behind the bell badge and the sidebar bubbles.
 *
 * The backend pushes `support:unread` to the signed-in user's own room whenever
 * either counter moves — a feed row written, a message read, a conversation
 * answered. Without this the badge only moved when a query happened to refetch,
 * so a notification arriving while someone sat on a page was invisible until
 * they navigated.
 *
 * Cross-area (`hooks/`, not `portal/`) because both shells need it and the two
 * areas never import from each other. The counters themselves are per-user and
 * area-agnostic — a staff member is a User row like any other — so the only
 * thing that differs between the two is which query key to refresh, which the
 * caller passes in.
 *
 * The fetched count is the seed and the socket is the correction: the query is
 * what makes the badge right on load (and on any tab with no socket yet), the
 * event is what keeps it right afterwards. The fetched value winning on change
 * matters — a mark-all-read invalidation must be able to pull the badge back to
 * zero even though no socket event describes it.
 */
export function useUnreadCounts(
  fetchedNotifications: number,
  // The notification query key this area caches under: `['notifications']` in
  // the portal, `['admin','notifications']` in the admin shell.
  notificationKey: readonly unknown[],
): { notifications: number; messages: number } {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [live, setLive] = useState<SocketUnread | null>(null);

  // A fresh fetch supersedes whatever the socket last said. Without this a
  // "mark all as read" would leave the old pushed number on the badge.
  useEffect(() => {
    setLive(null);
  }, [fetchedNotifications]);

  useSocketEvent<SocketUnread>(socket, SocketEvent.UNREAD, (payload) => {
    setLive(payload);

    // The rows behind the number are now stale. Invalidate rather than write the
    // count into the cache: the server is the authority on both, and the panel
    // re-reads them together so they cannot disagree.
    void queryClient.invalidateQueries({ queryKey: notificationKey });
  });

  return {
    notifications: live?.notifications ?? fetchedNotifications,
    messages: live?.messages ?? 0,
  };
}
