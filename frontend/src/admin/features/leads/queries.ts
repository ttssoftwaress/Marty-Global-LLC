import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';

/*
 * The marketing contact form's queue, staff side. A local mirror of the
 * backend's wire contract (AGENTS.md, two-apps sync) — source is
 * `backend/src/modules/admin/leads/`.
 */

export type AdminLeadStatus = 'all' | 'open' | 'handled';

/*
 * A row in the queue. The message is deliberately not on it — it is the
 * record's one unbounded field, and a page of the queue would otherwise carry
 * fifty of them to render a clamped line. `preview` is that line; the full text
 * arrives with `AdminLeadDetail` when a row is opened.
 */
export type AdminLead = {
  id: string;
  name: string;
  email: string;
  preview: string;
  handled: boolean;
  createdAt: string;
};

/** The expanded row: the message in full, and when it was picked up. */
export type AdminLeadDetail = AdminLead & {
  message: string;
  handledAt: string | null;
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

export const adminLeadKey = (id: string) => ['admin', 'leads', 'detail', id] as const;

/*
 * GET /v1/admin/leads/:id — one lead in full, for the expanded row.
 *
 * Called from inside the detail panel, which is only mounted while its row is
 * open, so nothing is fetched until somebody opens a lead.
 */
export function useAdminLead(id: string) {
  return useQuery({
    queryKey: adminLeadKey(id),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminLeadDetail>>(`/admin/leads/${id}`).then(
        (res) => res.data,
      ),
  });
}
