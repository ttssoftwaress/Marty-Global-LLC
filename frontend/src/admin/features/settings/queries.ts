import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminCarrier,
  AdminLocation,
  CarrierCreatePayload,
  CarrierUpdatePayload,
  LocationCreatePayload,
  LocationUpdatePayload,
} from '../../types/settings';

/*
 * Business settings data layer — locations and mail carriers.
 *
 * Both lists are short and admin-curated, so neither paginates: the endpoints
 * return the whole set, inactive rows included, because this is the screen where
 * a retired row is turned back on.
 *
 * Every write invalidates more than its own list. A location's label is printed
 * by the catalog's coverage picker, the orders queue's region filter, and the
 * customer list's region chip; a carrier's by the mail room's forwarding form.
 * Renaming one here has to reach all of them, so those caches drop too.
 */

export const adminLocationsKey = () => ['admin', 'settings', 'locations'] as const;
export const adminCarriersKey = () => ['admin', 'settings', 'carriers'] as const;

// GET /v1/admin/settings/locations
export function useAdminLocations() {
  return useQuery({
    queryKey: adminLocationsKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<{ locations: AdminLocation[] }>>(
        '/admin/settings/locations',
      ).then((res) => res.data.locations),
  });
}

// GET /v1/admin/settings/carriers
export function useAdminCarriers() {
  return useQuery({
    queryKey: adminCarriersKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<{ carriers: AdminCarrier[] }>>(
        '/admin/settings/carriers',
      ).then((res) => res.data.carriers),
  });
}

/*
 * The caches a settings write reaches beyond its own list. Named rather than
 * inlined per mutation so a new consumer is added in one place — the whole point
 * of this data being server-owned is that a rename lands everywhere at once.
 */
function invalidateLocationReaders(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: adminLocationsKey() });
  // The coverage picker and a service's supported-region chips.
  void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
  // The region filter on the orders queue and the chip on a customer's row.
  void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
}

function invalidateCarrierReaders(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: adminCarriersKey() });
  // The forwarding form's carrier select lives on the mail ops screen.
  void queryClient.invalidateQueries({ queryKey: ['admin', 'mailroom'] });
}

// POST /v1/admin/settings/locations
export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LocationCreatePayload) =>
      apiFetch<ApiSuccess<AdminLocation>>('/admin/settings/locations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => invalidateLocationReaders(queryClient),
  });
}

/*
 * PATCH /v1/admin/settings/locations/:code — edit a location.
 *
 * Also the retire/restore action: `active: false` closes the location to new
 * orders and drops it from every picker, while the filings already made in it
 * keep resolving. That is the normal way a jurisdiction leaves the list —
 * deleting is reserved for one nothing has ever referenced.
 */
export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      code,
      payload,
    }: {
      code: string;
      payload: LocationUpdatePayload;
    }) =>
      apiFetch<ApiSuccess<AdminLocation>>(`/admin/settings/locations/${code}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => invalidateLocationReaders(queryClient),
  });
}

// DELETE /v1/admin/settings/locations/:code — only ever succeeds for a location
// nothing references; the backend refuses it otherwise and says to turn it off.
export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<ApiSuccess<{ code: string }>>(
        `/admin/settings/locations/${code}`,
        { method: 'DELETE' },
      ).then((res) => res.data),
    onSuccess: () => invalidateLocationReaders(queryClient),
  });
}

/*
 * PUT /v1/admin/settings/locations/order — the complete sequence, not one row's
 * position. The order is a property of the list, so sending all of it means two
 * admins reordering at once cannot interleave into a ranking neither chose.
 */
export function useReorderLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (codes: string[]) =>
      apiFetch<ApiSuccess<{ locations: AdminLocation[] }>>(
        '/admin/settings/locations/order',
        { method: 'PUT', body: JSON.stringify({ codes }) },
      ).then((res) => res.data.locations),
    onSuccess: (locations) => {
      // The response is the reordered list — seed it rather than refetch, so the
      // rows do not flicker back through their old positions.
      queryClient.setQueryData(adminLocationsKey(), locations);
      invalidateLocationReaders(queryClient);
    },
  });
}

// POST /v1/admin/settings/carriers
export function useCreateCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CarrierCreatePayload) =>
      apiFetch<ApiSuccess<AdminCarrier>>('/admin/settings/carriers', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => invalidateCarrierReaders(queryClient),
  });
}

// PATCH /v1/admin/settings/carriers/:code — edit, retire, or restore a carrier.
export function useUpdateCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      code,
      payload,
    }: {
      code: string;
      payload: CarrierUpdatePayload;
    }) =>
      apiFetch<ApiSuccess<AdminCarrier>>(`/admin/settings/carriers/${code}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => invalidateCarrierReaders(queryClient),
  });
}

// DELETE /v1/admin/settings/carriers/:code — refused once anything has shipped
// with it, because those requests print its name.
export function useDeleteCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<ApiSuccess<{ code: string }>>(`/admin/settings/carriers/${code}`, {
        method: 'DELETE',
      }).then((res) => res.data),
    onSuccess: () => invalidateCarrierReaders(queryClient),
  });
}

// PUT /v1/admin/settings/carriers/order
export function useReorderCarriers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (codes: string[]) =>
      apiFetch<ApiSuccess<{ carriers: AdminCarrier[] }>>(
        '/admin/settings/carriers/order',
        { method: 'PUT', body: JSON.stringify({ codes }) },
      ).then((res) => res.data.carriers),
    onSuccess: (carriers) => {
      queryClient.setQueryData(adminCarriersKey(), carriers);
      invalidateCarrierReaders(queryClient);
    },
  });
}
