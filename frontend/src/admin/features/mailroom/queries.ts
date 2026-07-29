import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  MailLogFilters,
  MailLogPage,
  MailOpsRecentUpload,
  MailOpsRoom,
  MailOpsRoomName,
  MailOpsSummary,
  MailRequestDetail,
  MailRequestFilter,
  MailRequestPage,
  MailRequestResolution,
  MailRequestRow,
  MailScanDraft,
} from '../../types/mailroom';

/*
 * Admin virtual mail ops data layer. The endpoints land later with the
 * `mailroom` module (AGENTS.md, two-apps sync rule); these hooks fix the wire
 * contract the screen expects so the module drops in without touching the UI:
 *   - the summary, backing the three KPI figures and the tab counts in one call
 *     so they cannot disagree with each other
 *   - mail room search, server-resolved like every other list in the admin area,
 *     so the picker never filters a client-side copy of the room table
 *   - the recently-uploaded feed, cursor-paginated like every other list
 *   - the upload itself, which invalidates the feed and the summary so a filed
 *     scan appears without the screen re-deriving anything locally
 */

export const adminMailOpsSummaryKey = () =>
  ['admin', 'mailroom', 'summary'] as const;

// GET /v1/admin/mailroom/summary — the KPI figures and the tab counts.
export function useAdminMailOpsSummary() {
  return useQuery({
    queryKey: adminMailOpsSummaryKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<MailOpsSummary>>('/admin/mailroom/summary').then(
        (res) => res.data,
      ),
  });
}

export const adminMailOpsRoomNameSearchKey = (search: string) =>
  ['admin', 'mailroom', 'room-names', search] as const;

/*
 * GET /v1/admin/mailroom/rooms/names?search= — step one of the room picker.
 *
 * Rooms rather than customers: a customer may hold several mail rooms and an
 * envelope arrives at exactly one of them, so the room is what the operator
 * picks. Names come back deduplicated with a count, because a name is not unique
 * and the operator needs to know a second choice is coming.
 *
 * Only runs once the operator has typed something: an unfiltered fetch of every
 * mail room is the query this screen must never make.
 */
export function useAdminMailOpsRoomNameSearch(search: string) {
  const query = search.trim();

  return useQuery({
    queryKey: adminMailOpsRoomNameSearchKey(query),
    queryFn: () =>
      apiFetch<ApiSuccess<{ names: MailOpsRoomName[] }>>(
        `/admin/mailroom/rooms/names?search=${encodeURIComponent(query)}`,
      ).then((res) => res.data.names),
    enabled: query.length > 1,
  });
}

export const adminMailOpsRoomsByNameKey = (name: string) =>
  ['admin', 'mailroom', 'rooms', name] as const;

/*
 * GET /v1/admin/mailroom/rooms?name= — step two: the addresses under the name
 * chosen in step one, each with the customer it belongs to.
 *
 * `enabled` gates the call on a chosen name, so the hook can sit unconditionally
 * in the screen while the operator is still searching.
 */
export function useAdminMailOpsRoomsByName(name: string | null) {
  return useQuery({
    queryKey: adminMailOpsRoomsByNameKey(name ?? ''),
    queryFn: () =>
      apiFetch<ApiSuccess<{ rooms: MailOpsRoom[] }>>(
        `/admin/mailroom/rooms?name=${encodeURIComponent(name ?? '')}`,
      ).then((res) => res.data.rooms),
    enabled: name !== null,
  });
}

export const adminMailOpsRecentKey = () =>
  ['admin', 'mailroom', 'recent'] as const;

// GET /v1/admin/mailroom/scans?cursor= — the recently-uploaded feed, newest first.
export function useAdminMailOpsRecentUploads() {
  return useInfiniteQuery({
    queryKey: adminMailOpsRecentKey(),
    queryFn: ({ pageParam }) => {
      const query = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<
        ApiSuccess<{ uploads: MailOpsRecentUpload[]; nextCursor: string | null }>
      >(`/admin/mailroom/scans${query}`).then((res) => res.data);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/*
 * POST /v1/admin/mailroom/scans — file a scan into a customer's inbox.
 *
 * The body carries the R2 object key the scan was uploaded under, not the file
 * itself (AGENTS.md, Storage). Both the feed and the summary are invalidated on
 * success, since a filed scan moves the "new scans" figure as well as the list.
 */
export function useUploadMailScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: MailScanDraft) =>
      apiFetch<ApiSuccess<MailOpsRecentUpload>>('/admin/mailroom/scans', {
        method: 'POST',
        body: JSON.stringify(draft),
      }).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminMailOpsRecentKey() });
      void queryClient.invalidateQueries({ queryKey: adminMailOpsSummaryKey() });
    },
  });
}

export const adminMailRequestsKey = (filter: MailRequestFilter) =>
  ['admin', 'mailroom', 'requests', 'list', filter] as const;

/*
 * GET /v1/admin/mailroom/requests?filter=&cursor=&limit= — the forwarding /
 * shredding queue behind the "Pending requests" tab.
 *
 * Cursor-paginated like every other admin list (AGENTS.md), read as an infinite
 * query so the footer's numbered strip steps a window over one stream: the
 * absolute range and the page count come from the totals the backend returns
 * beside the cursor. The filter is applied server-side so the screen never holds
 * the whole queue to narrow a copy of it locally.
 *
 * The previous rows are kept in place while the next page or filter resolves, so
 * paging and filtering swap them without the table collapsing to a spinner.
 */
export function useAdminMailRequests(filter: MailRequestFilter) {
  return useInfiniteQuery({
    queryKey: adminMailRequestsKey(filter),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ filter });
      if (pageParam) params.set('cursor', pageParam);

      return apiFetch<ApiSuccess<MailRequestPage>>(
        `/admin/mailroom/requests?${params.toString()}`,
      ).then((res) => res.data);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previous) => previous,
  });
}

/*
 * POST /v1/admin/mailroom/requests/:id/process — work one request.
 *
 * The backend decides what "process" means for the request's type and what the
 * next status is; the client only names the row (AGENTS.md — business logic
 * lives in services). Both the queue and the summary are invalidated on
 * success, since working a request moves the KPI figures and the tab counts as
 * well as the row.
 */
export function useProcessMailRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) =>
      apiFetch<ApiSuccess<MailRequestRow>>(
        `/admin/mailroom/requests/${requestId}/process`,
        { method: 'POST' },
      ).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'mailroom', 'requests'],
      });
      void queryClient.invalidateQueries({ queryKey: adminMailOpsSummaryKey() });
    },
  });
}

export const adminMailRequestDetailKey = (requestId: string) =>
  ['admin', 'mailroom', 'requests', 'detail', requestId] as const;

/*
 * GET /v1/admin/mailroom/requests/:id — everything the slide-over renders.
 *
 * Fetched on open rather than carried on the queue row: the row would otherwise
 * have to hold a presigned scan URL for every request on the page, and those
 * URLs are short-TTL by design (AGENTS.md, Security & PII) — minting them for
 * rows nobody opens both wastes them and widens what a list response exposes.
 *
 * `enabled` gates the call on an id, so the hook can sit unconditionally in the
 * screen while no request is open.
 */
export function useAdminMailRequestDetail(requestId: string | null) {
  return useQuery({
    queryKey: adminMailRequestDetailKey(requestId ?? ''),
    queryFn: () =>
      apiFetch<ApiSuccess<MailRequestDetail>>(
        `/admin/mailroom/requests/${requestId}`,
      ).then((res) => res.data),
    enabled: requestId !== null,
  });
}

/*
 * POST /v1/admin/mailroom/requests/:id/resolve — settle one request from the
 * slide-over.
 *
 * Distinct from `useProcessMailRequest` above, which is the queue row's
 * one-click advance: this carries the operator's form — the tracking number and
 * carrier on a forwarding request, the notes on either — and is the call behind
 * "Mark as forwarded" / "Mark as shredded". The backend decides what settling
 * means for the request's type and what status it lands on; the client only
 * reports what was entered.
 *
 * The queue, the summary, and this request's own detail are all invalidated on
 * success, since settling moves the row, the KPI figures, and the tab counts.
 */
export function useResolveMailRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, ...body }: MailRequestResolution) =>
      apiFetch<ApiSuccess<MailRequestRow>>(
        `/admin/mailroom/requests/${requestId}/resolve`,
        { method: 'POST', body: JSON.stringify(body) },
      ).then((res) => res.data),
    onSuccess: (_row, { requestId }) => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'mailroom', 'requests'],
      });
      void queryClient.invalidateQueries({
        queryKey: adminMailOpsSummaryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey: adminMailRequestDetailKey(requestId),
      });
    },
  });
}

export const adminMailLogKey = (filters: MailLogFilters) =>
  ['admin', 'mailroom', 'log', filters] as const;

/*
 * GET /v1/admin/mailroom/log?search=&range=&action=&cursor=&limit= — the closed
 * history behind the "Mail log" tab.
 *
 * Cursor-paginated for the same reason the pending queue is, and read the same
 * way: an infinite query the footer's numbered strip steps a window over. All
 * three filters are applied server-side, so the screen never holds the whole log
 * to narrow a copy of it locally — the log is the longest list in this module
 * and the one that must never be fetched whole.
 *
 * The previous rows are kept in place while the next page resolves, so paging
 * and re-filtering swap them without the table collapsing to a spinner.
 */
export function useAdminMailLog(filters: MailLogFilters) {
  return useInfiniteQuery({
    queryKey: adminMailLogKey(filters),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        range: filters.range,
        action: filters.action,
      });

      const search = filters.search.trim();
      if (search) params.set('search', search);
      if (pageParam) params.set('cursor', pageParam);

      return apiFetch<ApiSuccess<MailLogPage>>(
        `/admin/mailroom/log?${params.toString()}`,
      ).then((res) => res.data);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previous) => previous,
  });
}
