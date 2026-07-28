import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminDocumentDisposition,
  AdminOrderDetail,
  AdminOrderDocument,
  AdminOrderDocumentLink,
  AdminOrderUpdate,
  AdminQuote,
  AdminQuoteTemplate,
  CreateQuoteInput,
} from '../../types/order-detail';
import type { AdminOrderRow } from '../../types/orders';

/*
 * Admin order-detail data layer — the order record plus the writes that work it:
 *   - the record itself, which carries the action choices with it, so the screen
 *     never has to know the pipeline
 *   - PATCH: advance the status / assign it
 *   - the quotes raised against it: list, send, withdraw
 *
 * Writing to the customer is not here — that is the order conversation
 * (features/order-conversation), the one two-way thread on the screen. The
 * activity feed this layer serves is read-only history.
 *
 * Every write invalidates the whole `['admin', 'orders']` subtree rather than
 * patching the cache by hand. A status change moves the order between the
 * queue's tabs and changes the counts beside them, so the queue this admin came
 * from has to be refetched anyway — and the server's version of the record is
 * the only one that reflects which statuses are now reachable.
 */

const ORDERS_SCOPE = ['admin', 'orders'] as const;

export const adminOrderKey = (orderId: string) =>
  [...ORDERS_SCOPE, 'detail', orderId] as const;

// GET /v1/admin/orders/:orderId
export function useAdminOrder(orderId: string) {
  return useQuery({
    queryKey: adminOrderKey(orderId),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminOrderDetail>>(`/admin/orders/${orderId}`).then(
        (res) => res.data,
      ),
    enabled: Boolean(orderId),
  });
}

// PATCH /v1/admin/orders/:orderId — status and assignee. The backend rejects a
// move the pipeline does not allow with a 422, which the screen surfaces rather
// than pre-empting.
export function useUpdateAdminOrder(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdminOrderUpdate) =>
      apiFetch<ApiSuccess<AdminOrderRow>>(`/admin/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_SCOPE });
    },
  });
}

/*
 * GET /v1/admin/orders/:orderId/documents/:documentId — a short-TTL link to one
 * of the order's documents.
 *
 * A mutation rather than a query, deliberately: a presigned URL is a bearer token
 * for the customer's own paperwork and expires in minutes, so it is minted on the
 * click that uses it rather than cached with the record and left to go stale (or
 * to survive in a shared screenshot). The backend audits every one of these.
 */
export function useAdminOrderDocumentLink(orderId: string) {
  return useMutation({
    mutationFn: ({
      documentId,
      disposition,
    }: {
      documentId: string;
      disposition: AdminDocumentDisposition;
    }) =>
      apiFetch<ApiSuccess<AdminOrderDocumentLink>>(
        `/admin/orders/${orderId}/documents/${documentId}?disposition=${disposition}`,
      ).then((res) => res.data),
  });
}

/*
 * POST /v1/admin/orders/:orderId/documents/request — ask the customer to upload
 * something.
 *
 * The row it creates is the request: a pending placeholder on this same card,
 * which the customer's upload fills in rather than landing beside. So this
 * invalidates the order record — the card the reviewer is looking at gains a row
 * the moment it succeeds — and the backend notifies the customer.
 */
export function useRequestAdminOrderDocument(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<ApiSuccess<AdminOrderDocument>>(
        `/admin/orders/${orderId}/documents/request`,
        { method: 'POST', body: JSON.stringify({ name }) },
      ).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_SCOPE });
    },
  });
}

export const adminOrderQuotesKey = (orderId: string) =>
  [...ORDERS_SCOPE, 'quotes', orderId] as const;

/*
 * The quotes raised against one order. A separate endpoint from the order
 * record because it carries a separate permission — quoting is the `payments`
 * area, not `orders` — so a reviewer without it still loads the order and this
 * query is the only thing that 403s.
 */
// GET /v1/admin/orders/:orderId/quotes
export function useAdminOrderQuotes(orderId: string) {
  return useQuery({
    queryKey: adminOrderQuotesKey(orderId),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminQuote[]>>(`/admin/orders/${orderId}/quotes`).then(
        (res) => res.data,
      ),
    enabled: Boolean(orderId),
    // A staff member without the `payments` area gets a 403 here; that is a
    // settled answer, not a transient failure, so retrying would only repeat it.
    retry: false,
  });
}

export const adminQuoteTemplatesKey = (orderId: string) =>
  [...ORDERS_SCOPE, 'quote-templates', orderId] as const;

/*
 * GET /v1/admin/orders/:orderId/quotes/templates — the catalog's pricing
 * templates for what this order is actually for.
 *
 * Reference prices change only when an admin edits the catalog, so this is stale
 * for far longer than the order record beside it. It is deliberately left out of
 * the write invalidations below: sending a quote does not change what the catalog
 * charges.
 */
export function useAdminQuoteTemplates(orderId: string) {
  return useQuery({
    queryKey: adminQuoteTemplatesKey(orderId),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminQuoteTemplate[]>>(
        `/admin/orders/${orderId}/quotes/templates`,
      ).then((res) => res.data),
    enabled: Boolean(orderId),
    // Same `payments` guard as the quote list — a 403 is settled, not transient.
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/*
 * POST /v1/admin/orders/:orderId/quotes — send the customer a price.
 *
 * Invalidates the order record as well as the quote list: sending a quote writes
 * an activity entry the order's feed renders, so the record the screen is
 * showing is stale the moment this succeeds.
 */
export function useCreateAdminQuote(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateQuoteInput) =>
      apiFetch<ApiSuccess<AdminQuote>>(`/admin/orders/${orderId}/quotes`, {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_SCOPE });
    },
  });
}

// POST /v1/admin/orders/:orderId/quotes/:quoteId/cancel — withdraw an offer that
// should no longer stand, which is what frees the order for a new one.
export function useCancelAdminQuote(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quoteId: string) =>
      apiFetch<ApiSuccess<AdminQuote>>(
        `/admin/orders/${orderId}/quotes/${quoteId}/cancel`,
        { method: 'POST' },
      ).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_SCOPE });
    },
  });
}

