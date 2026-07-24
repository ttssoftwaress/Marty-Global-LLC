import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type { ConversationSummary, ConversationThread } from '../../types/messages';

/*
 * Messages data layer. The Messages UI is the customer's window onto the
 * live-chat / support module (AGENTS.md, Live Chat), so both queries hit that
 * module and are scoped to the signed-in customer by the backend (endpoints
 * land later, two-apps sync rule):
 *   - the conversation list (server-filtered by the search box)
 *   - a single conversation's full thread
 * Each screen renders a skeleton until its query resolves and an empty state
 * once it does with nothing to show. Real-time delivery layers on top over
 * `services/socket.ts` when the support module lands.
 */

export const conversationsKey = (search: string) =>
  ['support', 'conversations', search] as const;

// GET /v1/support/conversations?search= — the customer's conversations, newest
// first. The backend resolves the search and ordering.
export function useConversations(search: string) {
  return useQuery({
    queryKey: conversationsKey(search),
    queryFn: () => {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : '';
      return apiFetch<ApiSuccess<ConversationSummary[]>>(
        `/support/conversations${query}`,
      ).then((res) => res.data);
    },
    // Keep the previous results on screen while a new search resolves, so typing
    // doesn't flash the skeleton.
    placeholderData: (previous) => previous,
  });
}

export const conversationKey = (conversationId: string) =>
  ['support', 'conversation', conversationId] as const;

// GET /v1/support/conversations/:id — one conversation with its full message
// history. The list summary fills the thread header while this resolves.
export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: conversationKey(conversationId),
    queryFn: () =>
      apiFetch<ApiSuccess<ConversationThread>>(
        `/support/conversations/${conversationId}`,
      ).then((res) => res.data),
    enabled: Boolean(conversationId),
  });
}
