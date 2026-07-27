import { useMutation, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { UploadedFile } from '@/services/upload';
import type { ApiSuccess } from '@/types/api';
import type {
  OrderConfirmation,
  OrderServiceCatalog,
} from '../../types/order-new-service';

/*
 * Order-new-service data layer. The catalog (Step 1/2) and the create-order
 * mutation (Step 2 → Step 3) both live here so the wizard pages stay
 * presentational and the API shapes are mirrored in one place (AGENTS.md, the
 * two-apps sync rule — the backend owns these; this is the local mirror).
 */

export const serviceCatalogKey = ['service-catalog'] as const;

// GET /v1/services/catalog — the active services, in display order. Cached for
// the session; the catalog rarely changes within a visit.
export function useServiceCatalog() {
  return useQuery({
    queryKey: serviceCatalogKey,
    queryFn: () =>
      apiFetch<ApiSuccess<OrderServiceCatalog>>('/services/catalog').then(
        (res) => res.data,
      ),
    staleTime: 5 * 60 * 1000,
  });
}

/*
 * The submit payload the create-order endpoint receives. Answers are keyed by
 * service id → field name; the customer fills in one merged master form, so this
 * is resolved from those merged answers at submit (`answersByServiceFrom`) —
 * each service receives exactly the questions it asked.
 *
 * `documents` carries the files the customer attached, already uploaded to R2 —
 * only their object keys travel here, never the bytes (AGENTS.md, Storage). It
 * is flat across the application rather than keyed by service, because a file
 * answered against one question and a general supporting document are both just
 * documents belonging to the same application.
 */
export type CreateOrderInput = {
  serviceIds: string[];
  answersByService: Record<string, Record<string, string>>;
  notes?: string;
  documents?: UploadedFile[];
};

// POST /v1/orders — creates the order and returns the confirmation Step 3 renders.
export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: CreateOrderInput) =>
      apiFetch<ApiSuccess<OrderConfirmation>>('/orders', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((res) => res.data),
  });
}
