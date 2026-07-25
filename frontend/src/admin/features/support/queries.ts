import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  SupportConversationsPage,
  SupportFilter,
  SupportThread,
} from '../../types/support';

/*
 * Admin support-inbox data layer. Two queries back the screen (endpoints land
 * later with the `support` module, AGENTS.md two-apps sync rule):
 *   - the conversation list, an infinite query over one cursor stream so the
 *     pane appends as it scrolls rather than paging
 *   - the open thread: its header, its assignee options, and its messages
 *
 * The list is server-resolved like every other list in the admin area — the
 * filter and the search are query params the backend applies, so the UI never
 * filters or counts rows client-side and what renders always agrees with the
 * counts printed beside it.
 *
 * Sending a reply or a note is owned by the `support` module over
 * `services/socket.ts` (AGENTS.md, Live Chat), so no mutation lives here yet.
 */

export const adminSupportConversationsKey = (
  filter: SupportFilter,
  search: string,
) => ['admin', 'support', 'conversations', { filter, search }] as const;

// GET /v1/admin/support/conversations?filter=&search=&cursor= — one page of the
// inbox, newest activity first. The backend owns the ordering and the counts.
function fetchAdminSupportConversationsPage(
  filter: SupportFilter,
  search: string,
  cursor: string | null,
): Promise<SupportConversationsPage> {
  const query = new URLSearchParams({ filter });
  if (search.trim()) query.set('search', search.trim());
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<SupportConversationsPage>>(
    `/admin/support/conversations?${query.toString()}`,
  ).then((res) => res.data);
}

export function useAdminSupportConversations(
  filter: SupportFilter,
  search: string,
) {
  return useInfiniteQuery({
    queryKey: adminSupportConversationsKey(filter, search),
    queryFn: ({ pageParam }) =>
      fetchAdminSupportConversationsPage(filter, search, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export const adminSupportThreadKey = (conversationId: string) =>
  ['admin', 'support', 'thread', conversationId] as const;

// GET /v1/admin/support/conversations/:conversationId — the open thread with its
// messages, internal notes, and the staff who may be assigned to it.
export function useAdminSupportThread(conversationId: string) {
  return useQuery({
    queryKey: adminSupportThreadKey(conversationId),
    queryFn: () =>
      apiFetch<ApiSuccess<SupportThread>>(
        `/admin/support/conversations/${conversationId}`,
      ).then((res) => res.data),
    enabled: Boolean(conversationId),
  });
}
