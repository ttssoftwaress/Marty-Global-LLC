import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { UploadedFile } from '@/services/upload';
import type { ApiSuccess } from '@/types/api';
import { orderDetailKey } from '../orders/queries';
import type { OrderDocument } from '../../types/orders';

/*
 * The write side of one order's detail screen — attaching documents and opening
 * them. Reads live in `features/orders/queries.ts` alongside the list.
 */

/*
 * POST /v1/orders/:id/documents — attach files the customer has already uploaded
 * to R2.
 *
 * The body carries object keys, never bytes (AGENTS.md, Storage). The order is
 * invalidated on success so the new rows appear with the activity entry the
 * backend writes alongside them.
 */
export function useAttachOrderDocuments(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { documents: UploadedFile[] }) =>
      apiFetch<ApiSuccess<{ documents: OrderDocument[] }>>(
        `/orders/${orderId}/documents`,
        { method: 'POST', body: JSON.stringify(input) },
      ).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderDetailKey(orderId) });
    },
  });
}

/*
 * GET /v1/orders/:id/documents/:documentId — a short-TTL link to one document.
 *
 * A mutation rather than a query, deliberately: a presigned URL is a bearer
 * token for the customer's own paperwork and expires in minutes, so it is minted
 * on the click that uses it rather than cached with the page and left to go
 * stale (or to survive in a shared screenshot).
 */
export function useOrderDocumentLink(orderId: string) {
  return useMutation({
    mutationFn: (documentId: string) =>
      apiFetch<ApiSuccess<{ name: string; url: string }>>(
        `/orders/${orderId}/documents/${documentId}`,
      ).then((res) => res.data),
  });
}
