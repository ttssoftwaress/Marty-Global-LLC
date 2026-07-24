import { useMutation, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
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

// The submit payload the create-order endpoint receives. Answers are keyed by
// service id → field name (the OrderApplicationDraft's answersByService), and
// notes are optional. Documents are deferred (R2 upload is a later task), so
// they are not sent yet.
export type CreateOrderInput = {
  serviceIds: string[];
  answersByService: Record<string, Record<string, string>>;
  notes?: string;
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
