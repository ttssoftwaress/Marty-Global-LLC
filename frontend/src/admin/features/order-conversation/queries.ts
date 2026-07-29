import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminOrderConversation,
  OrderConversationMessage,
  OrderConversationReplyKind,
} from '../../types/order-conversation';
import { adminOrderKey } from '../order-detail/queries';

/*
 * The staff side of an order's conversation.
 *
 * Deliberately the same endpoints the portal calls rather than an `/admin`
 * mirror: the participant rule is a property of the order — its customer and its
 * assignee — not of which portal asked, so one route serves both and the rule is
 * enforced in one place (AGENTS.md, two-apps sync rule).
 *
 * A staff member who is not this order's assignee gets a 404 from both, which is
 * the assignee lock doing its job.
 */

export const adminOrderConversationKey = (orderId: string) =>
  ['admin', 'order-conversation', orderId] as const;

// GET /v1/orders/:orderId/conversation — the thread, including internal notes,
// which the customer's own reads never return.
export function useAdminOrderConversation(orderId: string | undefined) {
  return useQuery({
    queryKey: adminOrderConversationKey(orderId ?? ''),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminOrderConversation>>(
        `/orders/${orderId}/conversation`,
      ).then((res) => res.data),
    enabled: Boolean(orderId),
  });
}

/*
 * POST /v1/orders/:orderId/conversation/messages — reply to the customer, or file
 * an internal note.
 *
 * `kind` is what separates the two, and the backend is what enforces it: a note
 * is stored with an author the customer's queries filter out, and it never
 * touches the thread preview the customer reads.
 */
export function useSendAdminOrderMessage(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: string; kind: OrderConversationReplyKind }) =>
      apiFetch<ApiSuccess<OrderConversationMessage>>(
        `/orders/${orderId}/conversation/messages`,
        { method: 'POST', body: JSON.stringify(input) },
      ).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminOrderConversationKey(orderId),
      });
      // Replying to an unassigned order claims it, so the order record the screen
      // is showing (its assignee, and the queue's counts) is now stale too.
      void queryClient.invalidateQueries({ queryKey: adminOrderKey(orderId) });
    },
  });
}
