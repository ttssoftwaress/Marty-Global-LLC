import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';

/*
 * The marketing contact form's queue, staff side. A local mirror of the
 * backend's wire contract (AGENTS.md, two-apps sync) — source is
 * `backend/src/modules/admin/leads/`.
 */

export type AdminLeadStatus = 'all' | 'open' | 'handled';

export type AdminLead = {
  id: string;
  name: string;
  email: string;
  message: string;
  handled: boolean;
  createdAt: string;
};

export type AdminLeadsPage = {
  leads: AdminLead[];
  openCount: number;
  nextCursor: string | null;
};

export const adminLeadsKey = (status: AdminLeadStatus) =>
  ['admin', 'leads', status] as const;

function fetchLeadsPage(
  status: AdminLeadStatus,
  cursor: string | null,
): Promise<AdminLeadsPage> {
  const query = new URLSearchParams();
  if (status !== 'open') query.set('status', status);
  if (cursor) query.set('cursor', cursor);

  const suffix = query.toString();
  return apiFetch<ApiSuccess<AdminLeadsPage>>(
    `/admin/leads${suffix ? `?${suffix}` : ''}`,
  ).then((res) => res.data);
}

// GET /v1/admin/leads
export function useAdminLeads(status: AdminLeadStatus) {
  return useInfiniteQuery({
    queryKey: adminLeadsKey(status),
    queryFn: ({ pageParam }) => fetchLeadsPage(status, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previous) => previous,
  });
}

// PATCH /v1/admin/leads/:id/handled
export function useSetLeadHandled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, handled }: { id: string; handled: boolean }) =>
      apiFetch<ApiSuccess<AdminLead>>(`/admin/leads/${id}/handled`, {
        method: 'PATCH',
        body: JSON.stringify({ handled }),
      }).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
    },
  });
}
