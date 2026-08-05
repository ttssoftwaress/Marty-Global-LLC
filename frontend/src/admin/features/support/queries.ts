import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  ComposerMode,
  SupportConversationsPage,
  SupportFilter,
  SupportMessage,
  SupportStatus,
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
 * Sending is realtime over `services/socket.ts` (AGENTS.md, Live Chat); the
 * mutation below is the fallback for a dropped connection and hits the same
 * backend service, so both transports write the same row the same way.
 * Assignment and status are ordinary writes — they are not chat.
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

export const adminSupportUnattendedKey = () =>
  ['admin', 'support', 'unattended'] as const;

/*
 * GET /v1/admin/support/unattended — how many chats are sitting in the queue with
 * nobody assigned to them. The seed for the sidebar badge; the socket keeps it
 * right afterwards (`useAdminUnattendedSupport`).
 *
 * `enabled` is the member's `support` grant. Without it the nav item is not drawn
 * at all and the endpoint would 403, so the shell must not ask.
 */
export function useAdminSupportUnattended(enabled: boolean) {
  return useQuery({
    queryKey: adminSupportUnattendedKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<{ count: number }>>('/admin/support/unattended').then(
        (res) => res.data,
      ),
    enabled,
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

/*
 * POST .../messages — a reply or an internal note.
 *
 * The mode is the whole difference and it is decided server-side from this
 * field: a reply reaches the customer and moves the thread's status, a note is
 * filed into the thread and never touches the preview the customer reads.
 */
export function useSendAdminSupportMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { body: string; kind: ComposerMode }) =>
      apiFetch<ApiSuccess<SupportMessage>>(
        `/admin/support/conversations/${conversationId}/messages`,
        { method: 'POST', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: (message) => {
      appendAdminMessage(queryClient, conversationId, message);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'support', 'conversations'],
      });
    },
  });
}

/*
 * PATCH the conversation — assignment and status.
 *
 * The backend returns the whole updated thread, so the response is written
 * straight into the cache rather than triggering a refetch: reassigning also
 * changes the assignable list and the status capsule, and a round trip would
 * show the old values for a beat.
 */
export function useUpdateAdminConversation(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { status?: SupportStatus; assigneeId?: string | null }) =>
      apiFetch<ApiSuccess<SupportThread>>(
        `/admin/support/conversations/${conversationId}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: (thread) => {
      queryClient.setQueryData(adminSupportThreadKey(conversationId), thread);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'support', 'conversations'],
      });
    },
  });
}

// POST .../read — the REST twin of the socket's read event, for a client whose
// connection is down.
export function useMarkAdminSupportRead() {
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<ApiSuccess<{ conversationId: string }>>(
        `/admin/support/conversations/${conversationId}/read`,
        { method: 'POST' },
      ).then((res) => res.data),
  });
}

/*
 * --- Cache helpers --------------------------------------------------------
 * Shared by the mutations above and the socket listener, so a message reaches
 * the cache the same way whichever transport delivered it.
 */

type QueryClient = ReturnType<typeof useQueryClient>;

// Add a message to the open thread, collapsing the optimistic bubble, the send's
// response, and the socket echo of the same message into one row.
export function appendAdminMessage(
  queryClient: QueryClient,
  conversationId: string,
  message: SupportMessage,
): void {
  queryClient.setQueryData<SupportThread>(
    adminSupportThreadKey(conversationId),
    (thread) => {
      if (!thread) return thread;

      const existing = thread.messages.findIndex(
        (entry) =>
          entry.id === message.id ||
          (message.clientId !== undefined && entry.clientId === message.clientId),
      );

      if (existing >= 0) {
        const messages = [...thread.messages];
        messages[existing] = { ...messages[existing], ...message, pending: false };
        return { ...thread, messages };
      }

      return { ...thread, messages: [...thread.messages, message] };
    },
  );
}

// Mark the agent's own replies as read by the customer, up to a point in time.
export function applyAdminReadReceipt(
  queryClient: QueryClient,
  conversationId: string,
  readAt: string,
): void {
  queryClient.setQueryData<SupportThread>(
    adminSupportThreadKey(conversationId),
    (thread) =>
      thread
        ? {
            ...thread,
            messages: thread.messages.map((message) =>
              message.kind === 'staff' && message.sentAt <= readAt
                ? { ...message, seen: true }
                : message,
            ),
          }
        : thread,
  );
}

// Withdraw an optimistic bubble whose send failed.
export function failAdminMessage(
  queryClient: QueryClient,
  conversationId: string,
  clientId: string,
): void {
  queryClient.setQueryData<SupportThread>(
    adminSupportThreadKey(conversationId),
    (thread) =>
      thread
        ? {
            ...thread,
            messages: thread.messages.filter((entry) => entry.clientId !== clientId),
          }
        : thread,
  );
}
