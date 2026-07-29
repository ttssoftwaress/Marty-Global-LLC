import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  CatalogServiceDetail,
  CatalogServicePage,
  ServiceDetailWritePayload,
  ServiceRegion,
  ServiceWritePayload,
} from '../../types/catalog';
import type {
  ResultFieldRef,
  ServiceRequestTypeDraft,
} from '../../types/delivery';

/*
 * Admin service catalog data layer (endpoints land later, AGENTS.md two-apps
 * sync rule):
 *   - the region set the form's chips offer, so adding a jurisdiction is a data
 *     change rather than a frontend deploy
 *   - the catalog list, cursor-paginated like every other list (AGENTS.md)
 *   - one service in full, fetched only when Manage opens — the list rows carry
 *     just what the table columns print, so the detail stays off the list query
 *   - create and update, which invalidate the list so a saved change is
 *     reflected without the screen re-deriving anything client-side
 *
 * Every figure the screen shows comes from these queries; nothing about the
 * catalog is hardcoded here.
 */

export const adminCatalogRegionsKey = () =>
  ['admin', 'catalog', 'regions'] as const;

// GET /v1/admin/catalog/regions — the jurisdictions a service can be offered in.
export function useAdminCatalogRegions() {
  return useQuery({
    queryKey: adminCatalogRegionsKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<{ regions: ServiceRegion[] }>>(
        '/admin/catalog/regions',
      ).then((res) => res.data.regions),
    // The region set changes rarely; no need to refetch it per modal open.
    staleTime: 5 * 60 * 1000,
  });
}

export const adminCatalogServicesKey = () =>
  ['admin', 'catalog', 'services'] as const;

// GET /v1/admin/catalog/services?cursor=&limit= — one page of the catalog.
export function useAdminCatalogServices() {
  return useInfiniteQuery({
    queryKey: adminCatalogServicesKey(),
    queryFn: ({ pageParam }) => {
      const query = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<ApiSuccess<CatalogServicePage>>(
        `/admin/catalog/services${query}`,
      ).then((res) => res.data);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export const adminCatalogServiceKey = (serviceId: string) =>
  ['admin', 'catalog', 'service', serviceId] as const;

/*
 * GET /v1/admin/catalog/services/:id — the full service the Manage form edits.
 * Disabled until a row is actually chosen, so opening the screen never fetches
 * a detail nobody asked for.
 */
export function useAdminCatalogService(serviceId: string | null) {
  return useQuery({
    queryKey: adminCatalogServiceKey(serviceId ?? ''),
    queryFn: () =>
      apiFetch<ApiSuccess<CatalogServiceDetail>>(
        `/admin/catalog/services/${serviceId}`,
      ).then((res) => res.data),
    enabled: Boolean(serviceId),
  });
}

/*
 * POST /v1/admin/catalog/services — add a service.
 *
 * Every catalog change is a state change on what customers can order and what
 * they'll be quoted, so the backend audits it (AGENTS.md) and resolves the
 * stored price from this payload's integer minor units — the client never sends
 * a float and never decides an amount at checkout.
 */
export function useCreateCatalogService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ServiceWritePayload) =>
      apiFetch<ApiSuccess<CatalogServiceDetail>>('/admin/catalog/services', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminCatalogServicesKey() });
    },
  });
}

/*
 * PATCH /v1/admin/catalog/services/:id — the detail screen's save.
 *
 * It writes the same endpoint as `useUpdateCatalogService` but a narrower body:
 * the detail page never edits a service's name or icon, so it never sends them
 * (a PATCH applies only what it carries). Kept separate from the modal's
 * mutation so the two payload shapes stay distinct at the type level rather than
 * merging into one partial-of-everything.
 *
 * Changing what a service costs or asks for is a state change on what customers
 * can order, so the backend audits it (AGENTS.md) and re-resolves prices from
 * these integer minor units — the client never sends a float.
 */
export function useUpdateCatalogServiceDetail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      serviceId,
      payload,
    }: {
      serviceId: string;
      payload: ServiceDetailWritePayload;
    }) =>
      apiFetch<ApiSuccess<CatalogServiceDetail>>(
        `/admin/catalog/services/${serviceId}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: (_data, { serviceId }) => {
      void queryClient.invalidateQueries({ queryKey: adminCatalogServicesKey() });
      void queryClient.invalidateQueries({
        queryKey: adminCatalogServiceKey(serviceId),
      });
    },
  });
}

// PATCH /v1/admin/catalog/services/:id — edit a service.
export function useUpdateCatalogService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      serviceId,
      payload,
    }: {
      serviceId: string;
      payload: ServiceWritePayload;
    }) =>
      apiFetch<ApiSuccess<CatalogServiceDetail>>(
        `/admin/catalog/services/${serviceId}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: (_data, { serviceId }) => {
      void queryClient.invalidateQueries({ queryKey: adminCatalogServicesKey() });
      void queryClient.invalidateQueries({
        queryKey: adminCatalogServiceKey(serviceId),
      });
    },
  });
}

/*
 * DELETE /v1/admin/catalog/services/:id — remove a service from the catalog.
 *
 * Only ever succeeds for a service nothing points at; the backend refuses it for
 * one that has been ordered or delivered and says to turn it off instead, which
 * is why the row hides the button rather than disabling it (`canDelete`).
 *
 * Even a successful call is a soft delete — the row keeps its configuration and
 * simply leaves every catalog read (AGENTS.md — ask before any hard delete).
 */
export function useDeleteCatalogService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceId: string) =>
      apiFetch<ApiSuccess<{ id: string }>>(
        `/admin/catalog/services/${serviceId}`,
        { method: 'DELETE' },
      ).then((res) => res.data),
    onSuccess: (_data, serviceId) => {
      queryClient.removeQueries({ queryKey: adminCatalogServiceKey(serviceId) });
      void queryClient.invalidateQueries({ queryKey: adminCatalogServicesKey() });
    },
  });
}

/*
 * PUT /v1/admin/catalog/services/:id/result-schema — what this service DELIVERS.
 *
 * Its own endpoint rather than another branch of the service PATCH, because it
 * is a different decision made at a different time: what a service sells is
 * settled when it is created, what it delivers once the team knows what the
 * filing actually produces.
 *
 * Reshaping it changes every customer page for the service, so the customer-side
 * caches go too — a delivered record renders the schema as it stands now.
 */
export function useUpdateResultSchema(serviceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      resultFields: ResultFieldRef[];
      resultPageTitle?: string;
      resultNoun?: string;
    }) =>
      apiFetch<ApiSuccess<CatalogServiceDetail>>(
        `/admin/catalog/services/${serviceId}/result-schema`,
        { method: 'PUT', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(adminCatalogServiceKey(serviceId), data);
      void queryClient.invalidateQueries({ queryKey: adminCatalogServicesKey() });
    },
  });
}

/*
 * PUT /v1/admin/catalog/services/:id/request-types — the buttons on the
 * customer's record for this service.
 *
 * A type dropped from the list is deactivated rather than deleted: requests
 * already raised under it point at the row, and the queue has to keep reading
 * them (AGENTS.md — ask before any hard delete).
 */
export function useUpdateRequestTypes(serviceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { requestTypes: ServiceRequestTypeDraft[] }) =>
      apiFetch<ApiSuccess<CatalogServiceDetail>>(
        `/admin/catalog/services/${serviceId}/request-types`,
        { method: 'PUT', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(adminCatalogServiceKey(serviceId), data);
    },
  });
}
