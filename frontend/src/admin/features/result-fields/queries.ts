import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  ResultFieldConfig,
  ResultFieldDefinition,
  ResultFieldPage,
  ResultFieldType,
} from '../../types/delivery';

/*
 * Result registry data layer — the vocabulary of facts services DELIVER.
 *
 * The mirror of `features/fields/queries.ts`, which does the same for the
 * questions services ASK. Two readers for the same reason that one has two:
 *   - `useAdminResultFields` — the management screen's paginated list, which can
 *     include archived rows.
 *   - `useResultFieldPicker` — the live list the service's delivery-schema
 *     builder picks from, cached longer and never archived, because a picker
 *     offering a retired fact would put it straight back into a live service.
 */

type ResultFieldFilters = {
  search?: string;
  type?: string;
  includeArchived?: boolean;
};

export const adminResultFieldsKey = (filters: ResultFieldFilters) =>
  ['admin', 'result-fields', filters] as const;

// GET /v1/admin/result-fields — one page of the registry.
export function useAdminResultFields(filters: ResultFieldFilters) {
  return useInfiniteQuery({
    queryKey: adminResultFieldsKey(filters),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.type) params.set('type', filters.type);
      if (filters.includeArchived) params.set('includeArchived', 'true');
      if (pageParam) params.set('cursor', pageParam);

      const query = params.toString();
      return apiFetch<ApiSuccess<ResultFieldPage>>(
        `/admin/result-fields${query ? `?${query}` : ''}`,
      ).then((res) => res.data);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export const resultFieldPickerKey = () =>
  ['admin', 'result-fields', 'picker'] as const;

export function useResultFieldPicker() {
  return useQuery({
    queryKey: resultFieldPickerKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<ResultFieldPage>>('/admin/result-fields?limit=100').then(
        (res) => res.data.fields,
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export type ResultFieldCreatePayload = {
  key: string;
  label: string;
  type: ResultFieldType;
  hint?: string;
  category?: string;
  config?: ResultFieldConfig;
  isPrimary?: boolean;
  showInList?: boolean;
};

export type ResultFieldUpdatePayload = Partial<
  Omit<ResultFieldCreatePayload, 'key'>
> & {
  archived?: boolean;
};

function invalidateResultFields(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'result-fields'] });
}

// POST /v1/admin/result-fields — register a returnable fact.
export function useCreateResultField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ResultFieldCreatePayload) =>
      apiFetch<ApiSuccess<ResultFieldDefinition>>('/admin/result-fields', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => invalidateResultFields(queryClient),
  });
}

/*
 * PATCH /v1/admin/result-fields/:id — edit a registered fact.
 *
 * Also the archive/restore action: retiring one is `archived: true`, which
 * removes it from the picker while leaving every delivered record that holds a
 * value for it intact. It is what the backend points at when a delete is refused
 * (AGENTS.md — ask before any hard delete), and the database enforces the same
 * with a `Restrict` on the value's foreign key.
 *
 * A delivered record may render a changed label, so the catalog caches go too.
 */
export function useUpdateResultField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fieldId,
      payload,
    }: {
      fieldId: string;
      payload: ResultFieldUpdatePayload;
    }) =>
      apiFetch<ApiSuccess<ResultFieldDefinition>>(
        `/admin/result-fields/${fieldId}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: () => {
      invalidateResultFields(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
    },
  });
}

/*
 * DELETE /v1/admin/result-fields/:id — remove a registered fact outright.
 *
 * The mirror of the request registry's: it only succeeds while no service
 * returns the fact and no delivered record holds a value for it, so something
 * registered by mistake is removable and a delivered record stays readable.
 */
export function useDeleteResultField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fieldId: string) =>
      apiFetch<ApiSuccess<{ id: string }>>(`/admin/result-fields/${fieldId}`, {
        method: 'DELETE',
      }).then((res) => res.data),
    onSuccess: () => {
      invalidateResultFields(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
    },
  });
}
