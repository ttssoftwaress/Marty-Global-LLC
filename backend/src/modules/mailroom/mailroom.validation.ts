import { z } from 'zod';

// The mail-room wire contract (AGENTS.md: Zod schemas are the source of truth).

// A room's three sub-views. Only `inbox` lists items; the other two are
// placeholder views the frontend renders without rows, so they resolve to an
// empty page rather than 400 — the tab is a valid state, just not populated yet.
export const mailRoomTab = z.enum(['inbox', 'requests', 'history']);
export type MailRoomTab = z.infer<typeof mailRoomTab>;

// `all` clears the filter; the rest map one-for-one onto a MailItemStatus.
// There is no `scanned` — whether the scan is ready is `scanReady`, not a
// lifecycle state (schema.prisma, MailItemStatus).
export const mailStatusFilter = z.enum([
  'all',
  'new',
  'viewed',
  'forwarded',
  'action_requested',
  'archived',
]);
export type MailStatusFilter = z.infer<typeof mailStatusFilter>;

/*
 * What the customer asks us to do with a piece of mail — the buttons on the item
 * slide-over. The request lands in the admin mail-ops queue; the backend decides
 * what happens next, so the payload carries nothing but the intent and an
 * optional note (AGENTS.md — business logic lives in services).
 *
 * The forwarding address is not accepted from the client: it is resolved from
 * the customer's own record at request time and snapshotted onto the row, so a
 * caller cannot redirect someone else's mail to an address they chose.
 *
 * `scan` is the envelope-first flow's ask: post is filed sealed, and this is the
 * customer telling us to open it. It is the only one of the three that does not
 * dispose of the item — the contents come back onto the same mail item, which is
 * why the inbox never grows a second row for the same letter.
 */
export const mailRequestType = z.enum(['forwarding', 'shredding', 'scan']);
export type MailRequestType = z.infer<typeof mailRequestType>;

export const createMailRequestSchema = z.object({
  type: mailRequestType,
  notes: z.string().trim().max(500).optional(),
});
export type CreateMailRequestInput = z.infer<typeof createMailRequestSchema>;

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
