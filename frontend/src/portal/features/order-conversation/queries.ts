import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  ConversationMessage,
  OrderConversation,
} from '../../types/conversation';

/*
 * The order conversation's data layer — the thread on an order's detail screen,
 * between the customer and the staff member their order is assigned to.
 *
 * A different endpoint from the Support screen's on purpose: that one is the
 * general support queue, this one is bound to an order and its assignee
 * (AGENTS.md two-apps sync rule — `modules/conversations` owns the rule).
 *
 * Real-time delivery layers on top over `services/socket.ts` when the live-chat
 * transport lands; until then the thread refetches after a send.
 */

export const orderConversationKey = (orderId: string) =>
  ['order-conversation', orderId] as const;

// GET /v1/orders/:orderId/conversation — the thread, created on first read. The
// backend resolves the participant check, so a customer whose order is not theirs
// gets a 404 rather than an empty thread.
export function useOrderConversation(orderId: string | undefined) {
  return useQuery({
    queryKey: orderConversationKey(orderId ?? ''),
    queryFn: () =>
      apiFetch<ApiSuccess<OrderConversation>>(
        `/orders/${orderId}/conversation`,
      ).then((res) => res.data),
    enabled: Boolean(orderId),
  });
}

/*
 * POST /v1/orders/:orderId/conversation/messages — send into the thread.
 *
 * The author is resolved server-side from the session, never sent, so a customer
 * cannot post as their specialist. The send is refused outright when the order
 * has no assignee yet — the composer renders that state, but the endpoint is what
 * enforces it.
 *
 * Invalidates the thread on success; the order detail is invalidated too, because
 * a reply is activity on the order.
 */
export function useSendOrderMessage(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<ApiSuccess<ConversationMessage>>(
        `/orders/${orderId}/conversation/messages`,
        { method: 'POST', body: JSON.stringify({ body }) },
      ).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orderConversationKey(orderId),
      });
    },
  });
}
