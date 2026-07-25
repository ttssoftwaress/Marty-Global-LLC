import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type { DashboardSummary } from '../../types/dashboard';

/*
 * Dashboard data layer. One query backs the whole home screen: the backend
 * composes the summary from the orders, billing, mail-room, and support modules
 * so every figure agrees with the page it links to, and scopes all of it to the
 * signed-in customer.
 */

export const dashboardSummaryKey = () => ['dashboard', 'summary'] as const;

// GET /v1/dashboard/summary — greeting, KPI metrics, recent orders, recent
// activity, and the billing / mail-room summary cards.
export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardSummaryKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<DashboardSummary>>('/dashboard/summary').then(
        (res) => res.data,
      ),
  });
}
