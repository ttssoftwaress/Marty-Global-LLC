import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  CustomerServiceSummary,
  ServiceRequestSummary,
  ServiceResultDetail,
  ServiceResultList,
  ServiceResultStatus,
} from '../../types/my-services';

/*
 * Delivered services data layer. Every endpoint is scoped to the signed-in
 * customer by the backend — a record belonging to somebody else 404s exactly
 * like one that does not exist, so nothing here filters by owner.
 *
 * The list is an infinite query over the same cursor stream the rest of the
 * portal uses (AGENTS.md, cursor pagination), so "Load more" appends without a
 * second pagination mode.
 */

export const ownedServicesKey = () => ['my-services', 'owned'] as const;

/*
 * GET /v1/my-services/services — which services this customer owns records for.
 *
 * Drives the sidebar's "My services" group, so it is fetched once at the shell
 * and cached: a customer with no delivered services gets no entries at all,
 * which is what keeps the nav from ever offering an empty page.
 */
export function useOwnedServices() {
  return useQuery({
    queryKey: ownedServicesKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<{ services: CustomerServiceSummary[] }>>(
        '/my-services/services',
      ).then((res) => res.data.services),
    // The set changes only when a filing completes, so a short stale window
    // keeps the sidebar from refetching on every navigation.
    staleTime: 60_000,
  });
}

type ResultListParams = {
  slug: string;
  status: ServiceResultStatus | 'all';
  search: string;
};

export const serviceResultsKey = (params: ResultListParams) =>
  ['my-services', params.slug, 'results', params.status, params.search] as const;

// GET /v1/my-services/:slug?status=&search=&cursor= — one page of the customer's
// records for a service, with the columns its table should print.
function fetchResultsPage(
  params: ResultListParams,
  cursor: string | null,
): Promise<ServiceResultList> {
  const query = new URLSearchParams();
  if (params.status !== 'all') query.set('status', params.status);
  if (params.search.trim()) query.set('search', params.search.trim());
  if (cursor) query.set('cursor', cursor);

  const suffix = query.toString();
  return apiFetch<ApiSuccess<ServiceResultList>>(
    `/my-services/${params.slug}${suffix ? `?${suffix}` : ''}`,
  ).then((res) => res.data);
}

export function useServiceResults(params: ResultListParams) {
  return useInfiniteQuery({
    queryKey: serviceResultsKey(params),
    queryFn: ({ pageParam }) => fetchResultsPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(params.slug),
    // Keep the previous filter's rows on screen while the next load resolves, so
    // changing tab or search doesn't flash the skeleton.
    placeholderData: (previous) => previous,
  });
}

export const serviceResultKey = (resultId: string) =>
  ['my-services', 'record', resultId] as const;

/*
 * GET /v1/my-services/records/:resultId — one record: its values, the follow-up
 * actions available against it, the requests already raised, and the order's
 * conversation id.
 *
 * Download links are short-TTL presigned URLs minted per request (AGENTS.md), so
 * this is deliberately not cached long — a stale link is a dead one.
 */
export function useServiceResult(resultId: string) {
  return useQuery({
    queryKey: serviceResultKey(resultId),
    queryFn: () =>
      apiFetch<ApiSuccess<ServiceResultDetail>>(
        `/my-services/records/${resultId}`,
      ).then((res) => res.data),
    enabled: Boolean(resultId),
    staleTime: 0,
  });
}

/*
 * POST /v1/my-services/records/:resultId/requests — raise a follow-up.
 *
 * The backend validates the answers against the request type's own intake form
 * and rejects a type belonging to another service, so this sends intent only.
 * On success both the record and the customer's request list are invalidated —
 * the new request appears on the record, and its open count shifts on the table
 * row that links to it.
 */
export function useCreateServiceRequest(resultId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestTypeId,
      answers,
      note,
    }: {
      requestTypeId: string;
      answers?: Record<string, string>;
      note?: string;
    }) =>
      apiFetch<ApiSuccess<ServiceRequestSummary>>(
        `/my-services/records/${resultId}/requests`,
        {
          method: 'POST',
          body: JSON.stringify({ requestTypeId, answers, note }),
        },
      ).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceResultKey(resultId) });
      // The row's open-request count lives in the list, which is keyed per
      // service and filter — invalidate the whole branch rather than guessing
      // which key the user arrived through.
      void queryClient.invalidateQueries({ queryKey: ['my-services'] });
    },
  });
}
