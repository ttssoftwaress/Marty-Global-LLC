import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminDashboardSummary,
  DashboardPeriod,
} from '../../types/dashboard';

/*
 * Admin dashboard data layer. One query backs the whole home screen: the backend
 * composes the summary from the orders, billing, customers, support, and
 * mail-room modules so every figure agrees with the page it links to.
 *
 * The period is part of the key, so switching the segmented pill fetches that
 * window and keeps the previous one cached for an instant switch back.
 */

export const adminDashboardSummaryKey = (period: DashboardPeriod) =>
  ['admin', 'dashboard', 'summary', period] as const;

// GET /v1/admin/dashboard/summary?period= — KPI metrics, the orders-by-status
// breakdown, the activity feed, and the needs-attention queue.
export function useAdminDashboardSummary(period: DashboardPeriod) {
  return useQuery({
    queryKey: adminDashboardSummaryKey(period),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminDashboardSummary>>(
        `/admin/dashboard/summary?period=${period}`,
      ).then((res) => res.data),
    // The previous period's data stays on screen while the next loads, so the
    // page does not flash a skeleton on every pill press.
    placeholderData: (previous) => previous,
  });
}
