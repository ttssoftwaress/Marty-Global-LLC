import { z } from 'zod';

// The mail-room wire contract (AGENTS.md: Zod schemas are the source of truth).

// A room's three sub-views. Only `inbox` lists items; the other two are
// placeholder views the frontend renders without rows, so they resolve to an
// empty page rather than 400 — the tab is a valid state, just not populated yet.
export const mailRoomTab = z.enum(['inbox', 'requests', 'history']);
export type MailRoomTab = z.infer<typeof mailRoomTab>;

// `all` clears the filter; the rest map one-for-one onto a MailItemStatus.
export const mailStatusFilter = z.enum([
  'all',
  'new',
  'viewed',
  'scanned',
  'forwarded',
  'action_requested',
  'archived',
]);
export type MailStatusFilter = z.infer<typeof mailStatusFilter>;

export const listMailItemsQuerySchema = z.object({
  tab: mailRoomTab.default('inbox'),
  status: mailStatusFilter.default('all'),
  search: z.string().trim().max(120).optional(),
  cursor: z.string().min(1).optional(),
  // The inbox renders 10 per page in the design; cap so a client can't ask for
  // an unbounded page.
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListMailItemsQuery = z.infer<typeof listMailItemsQuerySchema>;
