import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  MailItem,
  MailItemsPage,
  MailRequest,
  MailRequestType,
  MailRoomDetail,
  MailRoomOverview,
  MailRoomTab,
  MailStatusFilter,
} from '../../types/mailroom';

/*
 * Virtual mail rooms data layer. Three queries, all scoped to the signed-in
 * customer by the backend (endpoints land later, AGENTS.md two-apps sync rule):
 *   - the rooms overview (KPI figures + the customer's rooms)
 *   - a single room's detail (name/address + the inbox KPI figures)
 *   - a single room's mail items, an infinite query so the design's two
 *     pagination shapes both work over one cursor stream (AGENTS.md, cursor
 *     pagination): mobile "Load more" appends, desktop Prev/Next steps a window.
 * Each screen renders a skeleton until its query resolves and an empty state
 * once it does with nothing to show.
 */

export const mailRoomOverviewKey = () => ['mailrooms', 'overview'] as const;

// GET /v1/mailrooms/overview — headline figures and the customer's mail rooms.
export function useMailRoomOverview() {
  return useQuery({
    queryKey: mailRoomOverviewKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<MailRoomOverview>>('/mailrooms/overview').then(
        (res) => res.data,
      ),
  });
}

export const mailRoomDetailKey = (roomId: string) =>
  ['mailrooms', roomId, 'detail'] as const;

// GET /v1/mailrooms/:roomId — the room's name/address and its inbox figures.
export function useMailRoomDetail(roomId: string) {
  return useQuery({
    queryKey: mailRoomDetailKey(roomId),
    queryFn: () =>
      apiFetch<ApiSuccess<MailRoomDetail>>(`/mailrooms/${roomId}`).then(
        (res) => res.data,
      ),
    enabled: Boolean(roomId),
  });
}

type MailItemsParams = {
  roomId: string;
  tab: MailRoomTab;
  status: MailStatusFilter;
  search: string;
};

export const mailItemsKey = (params: MailItemsParams) =>
  [
    'mailrooms',
    params.roomId,
    'items',
    params.tab,
    params.status,
    params.search,
  ] as const;

// GET /v1/mailrooms/:roomId/items?tab=&status=&search=&cursor=&limit= — one page
// of the room's mail items. The backend resolves the tab, status, search,
// counts, and pagination.
function fetchMailItemsPage(
  params: MailItemsParams,
  cursor: string | null,
): Promise<MailItemsPage> {
  const query = new URLSearchParams({ tab: params.tab, status: params.status });
  if (params.search.trim()) query.set('search', params.search.trim());
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<MailItemsPage>>(
    `/mailrooms/${params.roomId}/items?${query.toString()}`,
  ).then((res) => res.data);
}

export const mailItemKey = (roomId: string, itemId: string) =>
  ['mailrooms', roomId, 'item', itemId] as const;

// GET /v1/mailrooms/:roomId/items/:itemId — one mail item with its scan pages
// and PDF as short-TTL presigned URLs (AGENTS.md, Security & PII), fetched
// fresh each time the viewer opens. The list copy fills the header meanwhile.
export function useMailItem(roomId: string, itemId: string) {
  return useQuery({
    queryKey: mailItemKey(roomId, itemId),
    queryFn: () =>
      apiFetch<ApiSuccess<MailItem>>(
        `/mailrooms/${roomId}/items/${itemId}`,
      ).then((res) => res.data),
    enabled: Boolean(roomId) && Boolean(itemId),
  });
}

export function useMailItems(params: MailItemsParams) {
  return useInfiniteQuery({
    queryKey: mailItemsKey(params),
    queryFn: ({ pageParam }) => fetchMailItemsPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    /*
     * All three tabs list items — they are one query with three scopes, and the
     * backend narrows the same stream (everything / an open request against it /
     * closed out). The Requests tab stopped being decorative the moment scanning
     * became a request, so gating this on `inbox` would have hidden the tab that
     * best answers "where has my scan got to".
     */
    enabled: Boolean(params.roomId),
    // Keep the previous filter's results on screen while the next load resolves,
    // so changing status/search doesn't flash the skeleton.
    placeholderData: (previous) => previous,
  });
}

/*
 * POST /v1/mailrooms/:roomId/items/:itemId/requests — ask us to scan, forward,
 * or shred a piece of mail.
 *
 * The forwarding address is not sent: the backend resolves it from the
 * customer's own company record and snapshots it onto the request, so a caller
 * can never redirect mail to an address they picked. The body carries the intent
 * and an optional note; the backend decides what happens next.
 *
 * Both the item and the room's figures are invalidated on success, since a
 * request moves the item into "action requested" and shifts the inbox counts.
 */
export function useCreateMailRequest(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      type,
      notes,
    }: {
      itemId: string;
      type: MailRequestType;
      notes?: string;
    }) =>
      apiFetch<ApiSuccess<MailRequest>>(
        `/mailrooms/${roomId}/items/${itemId}/requests`,
        { method: 'POST', body: JSON.stringify({ type, notes }) },
      ).then((res) => res.data),
    onSuccess: (_request, { itemId }) => {
      void queryClient.invalidateQueries({ queryKey: mailItemKey(roomId, itemId) });
      void queryClient.invalidateQueries({ queryKey: ['mailrooms', roomId, 'items'] });
      void queryClient.invalidateQueries({ queryKey: mailRoomDetailKey(roomId) });
      void queryClient.invalidateQueries({ queryKey: mailRoomOverviewKey() });
    },
  });
}

/*
 * POST /v1/mailrooms/:roomId/items/:itemId/downloaded — record that the customer
 * pulled the scan.
 *
 * Fire-and-forget beside the actual download: it writes the "Downloaded only"
 * row in the mail log, which is the only trace an item nobody asked us to
 * forward or shred was ever dealt with. The backend logs it once per item, so
 * re-opening the same PDF is not a second disposal.
 */
export function useRecordMailDownload(roomId: string) {
  return useMutation({
    mutationFn: (itemId: string) =>
      apiFetch<ApiSuccess<{ recorded: boolean }>>(
        `/mailrooms/${roomId}/items/${itemId}/downloaded`,
        { method: 'POST' },
      ).then((res) => res.data),
  });
}
