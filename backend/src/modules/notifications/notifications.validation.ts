import { z } from 'zod';

// The wire contract for queued notifications. Producers hand the service one of
// these; it renders and persists before anything is enqueued.

// The ledger's label for what an email was, not a choice of renderer — every one
// of these is rendered by GenericEmail. It exists so the Notification table can
// answer "how many offline handoffs did we send" without parsing subject lines.
export const emailTemplate = z.enum(['generic', 'support-offline-handoff']);

export type EmailTemplate = z.infer<typeof emailTemplate>;

export const sendEmailSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(200),
  template: emailTemplate.default('generic'),
  heading: z.string().min(1).max(200),
  body: z.string().min(1).max(5_000),
  actionLabel: z.string().min(1).max(60).optional(),
  actionUrl: z.url().optional(),
  userId: z.string().min(1).optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

// --- In-app feed ---------------------------------------------------------
// The customer's `/app/notifications` screen and the top-bar panel. Distinct
// from the email ledger above: that is an outbound delivery record, this is a
// feed entry the customer reads in the app.
//
// The filter tabs don't map one-to-one onto FeedNotificationCategory — "Status
// updates" covers the order/mailroom/payment lifecycle — so the tab→category
// mapping is resolved server-side (the service owns it).
export const notificationFilter = z.enum([
  'all',
  'unread',
  'status',
  'quotes',
  'documents',
  'messages',
]);
export type NotificationFilter = z.infer<typeof notificationFilter>;

export const listFeedQuerySchema = z.object({
  filter: notificationFilter.default('all'),
  cursor: z.string().min(1).optional(),
  // The feed renders 20 per page; the top-bar panel asks for fewer. Cap so a
  // client can't ask for an unbounded page.
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListFeedQuery = z.infer<typeof listFeedQuerySchema>;
