import { z } from 'zod';

/*
 * The admin dashboard wire contract. Mirrors
 * `frontend/src/admin/types/dashboard.ts`.
 *
 * One period scopes the whole screen, so every figure on the page belongs to the
 * same window and none of them can disagree with another.
 */

export const dashboardPeriod = z.enum(['today', 'week', 'month']);
export type DashboardPeriod = z.infer<typeof dashboardPeriod>;

export const summaryQuerySchema = z.object({
  period: dashboardPeriod.default('week'),
});
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
