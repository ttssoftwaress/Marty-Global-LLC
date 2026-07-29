import { useInfiniteQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type { StaffConversationsView } from '../../types/conversations';

/*
 * "My conversations" — the order threads this staff member is responsible for.
 *
 * Scoped to the session on the backend, never by an id this sends, so the only
 * parameter here is where in the cursor stream to read from: a staff member
 * cannot ask for another's threads.
 */

export const myConversationsKey = ['admin', 'conversations', 'mine'] as const;

// GET /v1/admin/conversations?cursor= — one page, newest activity first.
function fetchMyConversationsPage(
  cursor: string | null,
): Promise<StaffConversationsView> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

  return apiFetch<ApiSuccess<StaffConversationsView>>(
    `/admin/conversations${query}`,
  ).then((res) => res.data);
}

export function useMyConversations() {
  return useInfiniteQuery({
    queryKey: myConversationsKey,
    queryFn: ({ pageParam }) => fetchMyConversationsPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
