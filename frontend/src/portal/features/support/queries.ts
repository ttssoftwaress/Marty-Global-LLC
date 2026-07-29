import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  ConversationCategory,
  ConversationSummary,
  ConversationsPage,
  ConversationThread,
  Message,
  MessageAttachment,
} from '../../types/support';

/*
 * Support data layer. The Support UI is the customer's window onto the
 * live-chat / support module (AGENTS.md, Live Chat):
 *   - the conversation list (server-filtered by the search box)
 *   - a single conversation's full thread
 *   - opening a new thread, and posting into an existing one
 *
 * REST loads history and is the fallback path for sending; delivery in both
 * directions is realtime over `services/socket.ts` (see useConversationSocket).
 * The two agree because they call the same backend service — a socket message
 * and a POSTed one are the same row written by the same function.
 */

export const conversationsKey = (search: string) =>
  ['support', 'conversations', search] as const;

// GET /v1/support/conversations?search=&cursor= — one page of the customer's
// conversations, newest first. The backend resolves the search and the ordering.
function fetchConversationsPage(
  search: string,
  cursor: string | null,
): Promise<ConversationsPage> {
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  if (cursor) query.set('cursor', cursor);

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<ApiSuccess<ConversationsPage>>(
    `/support/conversations${suffix}`,
  ).then((res) => res.data);
}

/*
 * An infinite query over one cursor stream, like the admin inbox: the list pane
 * appends as it scrolls rather than asking the backend for every thread the
 * customer has ever opened.
 */
export function useConversations(search: string) {
  return useInfiniteQuery({
    queryKey: conversationsKey(search),
    queryFn: ({ pageParam }) => fetchConversationsPage(search, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep the previous results on screen while a new search resolves, so typing
    // doesn't flash the skeleton.
    placeholderData: (previous) => previous,
  });
}

// The pages flattened into the single list every consumer actually renders.
export function conversationsOf(
  data: { pages: ConversationsPage[] } | undefined,
): ConversationSummary[] | undefined {
  return data?.pages.flatMap((page) => page.conversations);
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

export type SendMessagePayload = {
  body: string;
  attachments?: {
    objectKey: string;
    name: string;
    sizeBytes: number;
    contentType?: string;
  }[];
};

/*
 * POST /v1/support/conversations/:id/messages — send into a thread.
 *
 * The socket is the primary send path; this is what carries a message when the
 * connection is down, and it is deliberately the same contract. The author is
 * resolved server-side from the session either way, so a customer cannot post as
 * an agent on either transport.
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SendMessagePayload) =>
      apiFetch<ApiSuccess<Message>>(
        `/support/conversations/${conversationId}/messages`,
        { method: 'POST', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: (message) => {
      // Appended rather than invalidated: the thread is already on screen and a
      // refetch would visibly rebuild it. The socket echo for this same message
      // is deduped by id in appendMessage.
      appendMessage(queryClient, conversationId, message);
      void queryClient.invalidateQueries({ queryKey: ['support', 'conversations'] });
    },
  });
}

export type CreateConversationPayload = {
  subject: string;
  category: ConversationCategory;
  body: string;
};

/*
 * POST /v1/support/conversations — open a new support thread.
 *
 * Nothing about routing is sent: the backend picks the agent as it creates the
 * thread, balanced across the team. Kept on REST rather than the socket because
 * it is a once-per-thread action with a form behind it, not a chat event.
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateConversationPayload) =>
      apiFetch<ApiSuccess<ConversationSummary>>('/support/conversations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support', 'conversations'] });
    },
  });
}

// POST /v1/support/conversations/:id/read — the REST twin of the socket's read
// event, for a client whose connection is down.
export function useMarkRead() {
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<ApiSuccess<{ conversationId: string }>>(
        `/support/conversations/${conversationId}/read`,
        { method: 'POST' },
      ).then((res) => res.data),
  });
}

/*
 * --- Cache helpers --------------------------------------------------------
 * Shared by the mutations above and the socket listener, so a message arrives in
 * the cache the same way whichever transport delivered it.
 */

type QueryClient = ReturnType<typeof useQueryClient>;

/*
 * Add a message to a thread, replacing its optimistic twin if there is one.
 *
 * Three cases have to collapse into one row: the bubble drawn the instant the
 * customer hit send, the server's reply to that send, and the socket echo of the
 * same message. They are matched by `clientId` first (the optimistic one has no
 * server id yet) and then by id, so a message can never render twice.
 */
export function appendMessage(
  queryClient: QueryClient,
  conversationId: string,
  message: Message,
): void {
  queryClient.setQueryData<ConversationThread>(
    conversationKey(conversationId),
    (thread) => {
      if (!thread) return thread;

      const existing = thread.messages.findIndex(
        (entry) =>
          entry.id === message.id ||
          (message.clientId !== undefined && entry.clientId === message.clientId),
      );

      if (existing >= 0) {
        const messages = [...thread.messages];
        // The server's copy wins on everything except the optimistic entry's
        // clientId, which is what future echoes are still matched against.
        messages[existing] = { ...messages[existing], ...message, pending: false };
        return { ...thread, messages };
      }

      return { ...thread, messages: [...thread.messages, message] };
    },
  );
}

// Draw the customer's own message before the server has confirmed it. Removed by
// `failMessage` if the send never lands.
export function appendOptimistic(
  queryClient: QueryClient,
  conversationId: string,
  message: { clientId: string; body: string; attachments?: MessageAttachment[] },
): void {
  appendMessage(queryClient, conversationId, {
    // Never collides with a cuid, and the row is replaced the moment the server
    // answers — this only has to be unique within the thread on screen.
    id: `pending-${message.clientId}`,
    clientId: message.clientId,
    author: 'customer',
    body: message.body,
    sentAt: new Date().toISOString(),
    attachments: message.attachments,
    pending: true,
    seen: false,
  });
}

// Drop an optimistic bubble whose send failed, so the customer is not left
// looking at a message that was never delivered.
export function failMessage(
  queryClient: QueryClient,
  conversationId: string,
  clientId: string,
): void {
  queryClient.setQueryData<ConversationThread>(
    conversationKey(conversationId),
    (thread) =>
      thread
        ? {
            ...thread,
            messages: thread.messages.filter((entry) => entry.clientId !== clientId),
          }
        : thread,
  );
}

// Mark the customer's own messages as read by the team, up to a point in time.
export function applyReadReceipt(
  queryClient: QueryClient,
  conversationId: string,
  readAt: string,
): void {
  queryClient.setQueryData<ConversationThread>(
    conversationKey(conversationId),
    (thread) =>
      thread
        ? {
            ...thread,
            messages: thread.messages.map((message) =>
              message.author === 'customer' && message.sentAt <= readAt
                ? { ...message, seen: true }
                : message,
            ),
          }
        : thread,
  );
}
