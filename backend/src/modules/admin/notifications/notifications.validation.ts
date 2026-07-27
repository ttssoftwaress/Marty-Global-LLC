import { z } from 'zod';

/*
 * The staff member's own in-app feed — the admin top-bar panel and
 * `/admin/notifications`. It reads the same FeedNotification ledger as the
 * customer feed (a staff member is a User row like any other), so the shape of
 * the contract matches; what differs is the tabs.
 *
 * The customer's tabs are about their paperwork ("Quotes", "Documents"); a staff
 * member's are about the work queues they own, so the filter set here is the
 * admin sections rather than a copy of the portal's. As on the customer side the
 * tab→category mapping is resolved server-side — "Status updates" is a
 * lifecycle, not a category.
 */

export const adminNotificationFilter = z.enum([
  'all',
  'unread',
  'orders',
  'payments',
  'support',
  'mailroom',
]);
export type AdminNotificationFilter = z.infer<typeof adminNotificationFilter>;

export const listAdminFeedQuerySchema = z.object({
  filter: adminNotificationFilter.default('all'),
  cursor: z.string().min(1).optional(),
  // The page renders 20 per load; the top-bar panel asks for fewer. Capped so a
  // client can't ask for an unbounded page (AGENTS.md, API conventions).
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListAdminFeedQuery = z.infer<typeof listAdminFeedQuerySchema>;
