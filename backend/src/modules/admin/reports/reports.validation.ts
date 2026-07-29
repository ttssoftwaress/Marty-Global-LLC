import { z } from 'zod';

/*
 * The admin reports & analytics wire contract. Mirrors
 * `frontend/src/admin/types/reports.ts`.
 *
 * A fixed period sends only its name and lets the backend resolve the
 * boundaries, which is what keeps the timezone question server-side (AGENTS.md,
 * Dates). A custom range additionally carries the two dates the picker produced.
 */

export const reportPeriod = z.enum(['30d', '90d', 'ytd', 'custom']);
export type ReportPeriod = z.infer<typeof reportPeriod>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-MM-dd');

export const reportRangeSchema = z
  .object({
    period: reportPeriod.default('30d'),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine(
    (value) => value.period !== 'custom' || (Boolean(value.from) && Boolean(value.to)),
    { message: 'A custom range needs both from and to' },
  )
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'from must not be after to',
  });
export type ReportRange = z.infer<typeof reportRangeSchema>;

// The two donut cards run the same query against a different dimension.
export const breakdownDimension = z.enum(['service', 'region']);
export type BreakdownDimension = z.infer<typeof breakdownDimension>;
