import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type { AdminMe } from '../types/admin-me';

/*
 * GET /v1/admin/me — the signed-in staff member's own record: name, job-role
 * label, and the permission areas they hold.
 *
 * Every `/admin/*` screen needs this to render its sidebar, so it sits under one
 * query key and is shared through the cache rather than threaded down from a
 * page. The admin layout is remounted on each navigation (each page renders its
 * own), which would otherwise mean a request per screen.
 *
 * Permissions change only when an admin edits the member on the team screen —
 * rare, and it takes effect on their next load — so this is held far longer than
 * a list query. It stays fresh across navigation instead of refetching behind
 * the nav on every screen change, which would make items flicker in and out.
 */

export const adminMeKey = () => ['admin', 'me'] as const;

const FIVE_MINUTES = 5 * 60 * 1000;

export function useAdminMe() {
  return useQuery({
    queryKey: adminMeKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminMe>>('/admin/me').then((res) => res.data),
    staleTime: FIVE_MINUTES,
  });
}
