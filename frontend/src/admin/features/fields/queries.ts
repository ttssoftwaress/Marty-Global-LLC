import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  FieldCreatePayload,
  FieldDefinition,
  FieldDefinitionPage,
  FieldUpdatePayload,
} from '../../types/fields';

/*
 * Field registry data layer.
 *
 * Two readers, deliberately separate:
 *   - `useAdminFields` — the management screen's paginated, filterable list,
 *     which can include archived rows.
 *   - `useFieldPicker` — the flat list of live fields the service form builder
 *     picks from. Cached longer and never archived, because a picker offering a
 *     retired question would put it straight back into a live form.
 */

export const adminFieldsKey = (filters: {
  search?: string;
  type?: string;
  includeArchived?: boolean;
}) => ['admin', 'fields', filters] as const;

// GET /v1/admin/fields — one page of the registry.
export function useAdminFields(filters: {
  search?: string;
  type?: string;
  includeArchived?: boolean;
}) {
  return useInfiniteQuery({
    queryKey: adminFieldsKey(filters),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.type) params.set('type', filters.type);
      if (filters.includeArchived) params.set('includeArchived', 'true');
      if (pageParam) params.set('cursor', pageParam);

      const query = params.toString();
      return apiFetch<ApiSuccess<FieldDefinitionPage>>(
        `/admin/fields${query ? `?${query}` : ''}`,
      ).then((res) => res.data);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export const fieldPickerKey = () => ['admin', 'fields', 'picker'] as const;

/*
 * The live registry, for the form builder's picker. Requests a large page
 * because the picker groups and filters client-side — the registry is an
 * admin-curated vocabulary of tens of entries, not an unbounded list.
 */
export function useFieldPicker() {
  return useQuery({
    queryKey: fieldPickerKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<FieldDefinitionPage>>('/admin/fields?limit=100').then(
        (res) => res.data.fields,
      ),
    staleTime: 5 * 60 * 1000,
  });
}

// Every registry read, invalidated together after a write — the picker and the
// management list are two views of one table.
function invalidateFields(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'fields'] });
}

// POST /v1/admin/fields — register a field.
export function useCreateField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FieldCreatePayload) =>
      apiFetch<ApiSuccess<FieldDefinition>>('/admin/fields', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => invalidateFields(queryClient),
  });
}

/*
 * PATCH /v1/admin/fields/:id — edit a registered field.
 *
 * Also the archive/restore action: retiring a field is `archived: true`, which
 * removes it from the picker while leaving every form and answer that already
 * references it intact. It is what the backend points at when a delete is
 * refused — a field a historical order holds an answer for must stay resolvable
 * (AGENTS.md — ask before any hard delete).
 *
 * A catalog service may render a changed label, so the catalog caches are
 * invalidated too.
 */
export function useUpdateField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fieldId,
      payload,
    }: {
      fieldId: string;
      payload: FieldUpdatePayload;
    }) =>
      apiFetch<ApiSuccess<FieldDefinition>>(`/admin/fields/${fieldId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => {
      invalidateFields(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
    },
  });
}

/*
 * DELETE /v1/admin/fields/:id — remove a registered question outright.
 *
 * Only ever succeeds for a field nothing has ever referenced: no service form,
 * no request form, no stored answer. That is what makes a question registered by
 * mistake removable rather than archived forever, and the backend owns the check
 * — the row hides the button when `canDelete` is false, and the endpoint still
 * refuses the call if a stored answer turns up behind a key no form uses.
 */
export function useDeleteField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fieldId: string) =>
      apiFetch<ApiSuccess<{ id: string }>>(`/admin/fields/${fieldId}`, {
        method: 'DELETE',
      }).then((res) => res.data),
    onSuccess: () => {
      invalidateFields(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
    },
  });
}
