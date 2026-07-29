import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type { FileDisposition } from '../../lib/open-file';
import type {
  AdminOrderItemDelivery,
  AdminRequestDetail,
  AdminRequestPage,
  AdminResultFileLink,
  ResultValueInput,
  ServiceRequestStatus,
} from '../../types/delivery';
import { adminOrderKey } from '../order-detail/queries';

/*
 * Service delivery data layer, staff side.
 *
 * Two halves behind two permission areas: the result form is `orders` work (the
 * last step of the filing), and the queue is `requests` work (after-sales). The
 * backend enforces both; these are just the calls.
 */

export const orderItemResultKey = (orderItemId: string) =>
  ['admin', 'order-items', orderItemId, 'result'] as const;

/*
 * GET /v1/admin/order-items/:id/result — the result form for one service line.
 *
 * Creates the DRAFT record on first open, which is what lets the form be a plain
 * edit screen rather than distinguishing a first save from a later one. A draft
 * is invisible to the customer, so an abandoned one costs nothing.
 */
export function useOrderItemResult(orderItemId: string, enabled = true) {
  return useQuery({
    queryKey: orderItemResultKey(orderItemId),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminOrderItemDelivery>>(
        `/admin/order-items/${orderItemId}/result`,
      ).then((res) => res.data),
    enabled: Boolean(orderItemId) && enabled,
  });
}

/*
 * PUT /v1/admin/order-items/:id/result — save the form.
 *
 * `deliver` is the difference between a draft and a delivery: false saves
 * progress and leaves the record invisible, true publishes it to the customer
 * and marks the service line complete. The backend refuses a delivery with a
 * required field still blank (422) — the button is disabled for the same reason,
 * but the endpoint is the boundary that matters.
 */
export function useSaveOrderItemResult(orderItemId: string, orderId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      values,
      deliver,
    }: {
      values: ResultValueInput[];
      deliver?: boolean;
    }) =>
      apiFetch<ApiSuccess<AdminOrderItemDelivery>>(
        `/admin/order-items/${orderItemId}/result`,
        { method: 'PUT', body: JSON.stringify({ values, deliver }) },
      ).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(orderItemResultKey(orderItemId), data);
      // Delivering completes the service line and writes an activity entry, so
      // the order screen behind the form is stale either way.
      if (orderId) {
        void queryClient.invalidateQueries({ queryKey: adminOrderKey(orderId) });
      }
    },
  });
}

/*
 * PATCH /v1/admin/order-items/:id/status — move a service line without a result.
 *
 * Only reaches COMPLETED for a service that returns nothing; one that delivers a
 * record is completed by delivering it, so the gate cannot be stepped around.
 */
export function useUpdateOrderItemStatus(orderItemId: string, orderId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: 'pending' | 'in_progress' | 'completed') =>
      apiFetch<ApiSuccess<AdminOrderItemDelivery>>(
        `/admin/order-items/${orderItemId}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      ).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(orderItemResultKey(orderItemId), data);
      if (orderId) {
        void queryClient.invalidateQueries({ queryKey: adminOrderKey(orderId) });
      }
    },
  });
}

/*
 * GET /v1/admin/records/:resultId/files/:fieldKey — a short-TTL link to a
 * document already on the record.
 *
 * A mutation rather than a query, deliberately: a presigned URL is a bearer token
 * for the customer's paperwork and expires in minutes, so it is minted on the
 * click that uses it rather than cached with the record. Hung off the record id,
 * which both the order screen and the follow-up queue already hold — one endpoint
 * for both entry points into the form.
 */
export function useResultFileLink(resultId: string) {
  return useMutation({
    mutationFn: ({
      fieldKey,
      disposition,
    }: {
      fieldKey: string;
      disposition: FileDisposition;
    }) =>
      apiFetch<ApiSuccess<AdminResultFileLink>>(
        `/admin/records/${resultId}/files/${encodeURIComponent(fieldKey)}?disposition=${disposition}`,
      ).then((res) => res.data),
  });
}

// PATCH /v1/admin/records/:id/status — archive or reactivate a delivered record.
export function useUpdateResultStatus(orderItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      resultId,
      status,
    }: {
      resultId: string;
      status: 'active' | 'archived';
    }) =>
      apiFetch<ApiSuccess<unknown>>(`/admin/records/${resultId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderItemResultKey(orderItemId) });
    },
  });
}

// --- The follow-up queue --------------------------------------------------

export type RequestQueueFilters = {
  status: ServiceRequestStatus | 'all';
  assignee: 'all' | 'me' | 'unassigned';
  search: string;
};

export const adminRequestsKey = (filters: RequestQueueFilters) =>
  ['admin', 'requests', filters.status, filters.assignee, filters.search] as const;

function fetchRequestsPage(
  filters: RequestQueueFilters,
  cursor: string | null,
): Promise<AdminRequestPage> {
  const query = new URLSearchParams();
  if (filters.status !== 'all') query.set('status', filters.status);
  if (filters.assignee !== 'all') query.set('assignee', filters.assignee);
  if (filters.search.trim()) query.set('search', filters.search.trim());
  if (cursor) query.set('cursor', cursor);

  const suffix = query.toString();
  return apiFetch<ApiSuccess<AdminRequestPage>>(
    `/admin/requests${suffix ? `?${suffix}` : ''}`,
  ).then((res) => res.data);
}

// GET /v1/admin/requests — the queue, scoped by the backend to what this member
// may see (their own plus the unclaimed backlog, or the whole org).
export function useAdminRequests(filters: RequestQueueFilters) {
  return useInfiniteQuery({
    queryKey: adminRequestsKey(filters),
    queryFn: ({ pageParam }) => fetchRequestsPage(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previous) => previous,
  });
}

export const adminRequestKey = (requestId: string) =>
  ['admin', 'requests', requestId] as const;

export function useAdminRequest(requestId: string) {
  return useQuery({
    queryKey: adminRequestKey(requestId),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminRequestDetail>>(`/admin/requests/${requestId}`).then(
        (res) => res.data,
      ),
    enabled: Boolean(requestId),
  });
}

/*
 * PATCH /v1/admin/requests/:id — move it, reassign it, or add a note.
 *
 * `assigneeId: null` unassigns; omitting it leaves the assignee alone. The two
 * have to be distinguishable, which is why the field is nullable rather than
 * merely optional.
 */
export function useUpdateAdminRequest(requestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      status?: ServiceRequestStatus;
      assigneeId?: string | null;
      blockedReason?: string;
      resolution?: string;
      note?: string;
      internal?: boolean;
    }) =>
      apiFetch<ApiSuccess<AdminRequestDetail>>(`/admin/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(adminRequestKey(requestId), data);
      // The row's status and assignee changed, and the queue is keyed per
      // filter — invalidate the branch rather than guessing which key the
      // member arrived through.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'requests'] });
    },
  });
}

export const adminRequestResultKey = (requestId: string) =>
  ['admin', 'requests', requestId, 'result'] as const;

/*
 * The record behind a request, so staff can amend the delivered data without
 * leaving the queue — "edit the result page as per the request".
 *
 * Reached through the request rather than by record id, which keeps the
 * `requests` area from doubling as a way to browse every delivered record.
 */
export function useAdminRequestResult(requestId: string, enabled = true) {
  return useQuery({
    queryKey: adminRequestResultKey(requestId),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminOrderItemDelivery>>(
        `/admin/requests/${requestId}/result`,
      ).then((res) => res.data),
    enabled: Boolean(requestId) && enabled,
  });
}

// PUT /v1/admin/requests/:id/result — save that amendment. Runs the same write
// path as the order screen, so the required-field gate is identical.
export function useSaveAdminRequestResult(requestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      values,
      deliver,
    }: {
      values: ResultValueInput[];
      deliver?: boolean;
    }) =>
      apiFetch<ApiSuccess<AdminOrderItemDelivery>>(
        `/admin/requests/${requestId}/result`,
        { method: 'PUT', body: JSON.stringify({ values, deliver }) },
      ).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(adminRequestResultKey(requestId), data);
      // The record's primary field is the queue row's own title, so amending it
      // restates the list as well as this request. Invalidate the whole branch —
      // it covers the detail and every filter key the member could have arrived
      // through, the same reason the status/assignee mutation does.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'requests'] });
    },
  });
}
