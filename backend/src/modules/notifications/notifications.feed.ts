import { FeedNotificationCategory } from '@prisma/client';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { emitUnreadChanged } from '../../sockets/broadcast.js';
import {
  channelsFor,
  type NotificationCategory,
} from './notifications.preferences.js';

/*
 * The one way to put a row in someone's in-app feed.
 *
 * Before this existed, five call sites each hand-rolled the same
 * `prisma.feedNotification.create` — and each was independently responsible for
 * remembering to check `channelsFor` first. Four of them did; the fifth is the
 * kind of omission that makes the settings screen a lie, which is exactly the
 * failure `notifications.preferences.ts` was written to end for email. This is
 * the same fix for the in-app channel: a caller names a preference category to
 * write a row at all, so the gate cannot be skipped by forgetting it.
 *
 * It also owns the live push. A feed row that only appears on the next refetch
 * is not a notification, it is a record of one — so every write nudges the
 * owner's sockets with their new unread count.
 *
 * Nothing here throws into the caller. Being told about an event is a
 * consequence of that event, never a condition of it: an operator who filed a
 * scan correctly must not see a failure because Redis was down. Callers that
 * need the row to be part of their own transaction pass `tx` (see
 * `createFeedNotificationIn`).
 */

export type FeedNotificationInput = {
  userId: string;
  category: FeedNotificationCategory;
  // Stored display-ready: resolved server-side, amounts already formatted.
  message: string;
  // A relative in-app path. Omitted for a purely informational row.
  href?: string;
};

/*
 * Write a feed row for a customer, honouring their notification matrix.
 *
 * `preference` is the row of `/app/settings` this event belongs to. Returns
 * whether a row was written, so a caller can log or branch on a muted event
 * without re-reading the preference itself.
 */
export async function notifyFeed(
  input: FeedNotificationInput & { preference: NotificationCategory },
): Promise<{ created: boolean }> {
  try {
    const { inApp } = await channelsFor(input.userId, input.preference);
    if (!inApp) return { created: false };

    await createFeedNotification(input);
    return { created: true };
  } catch (error) {
    // Ids only — a feed message can name a sender or a company (AGENTS.md, PII).
    logger.error(
      { err: error, userId: input.userId, category: input.category },
      'Failed to write an in-app notification',
    );
    return { created: false };
  }
}

/*
 * Write the row unconditionally, no preference lookup.
 *
 * For notices the customer cannot opt out of — the same carve-out the email side
 * documents at the foot of `notifications.preferences.ts`. A payment that
 * arrived short is the standing example: the customer's order does not move
 * until they act on it, so a muted category must not be the reason they never
 * find out. Staff feed rows use this too — a work queue is not a preference.
 */
export async function createFeedNotification(
  input: FeedNotificationInput,
): Promise<void> {
  await prisma.feedNotification.create({
    data: {
      userId: input.userId,
      category: input.category,
      message: input.message,
      href: input.href,
    },
  });

  // After the write, never instead of it (AGENTS.md, persist-then-emit). The
  // payload is a count, not the message — the client re-reads the feed through
  // the API, which applies the scope the socket would.
  emitUnreadChanged(input.userId);
}

/*
 * The same write, inside a caller's transaction.
 *
 * A quote is issued and its feed row created in one `$transaction` so a rolled
 * back quote cannot leave a notification pointing at a quote that does not
 * exist. The push is deliberately NOT emitted here: the transaction has not
 * committed yet, and a client told to refetch before the commit would read the
 * old count and keep it. Callers emit `emitUnreadChanged` after their commit.
 */
export async function createFeedNotificationIn(
  tx: Pick<typeof prisma, 'feedNotification'>,
  input: FeedNotificationInput,
): Promise<void> {
  await tx.feedNotification.create({
    data: {
      userId: input.userId,
      category: input.category,
      message: input.message,
      href: input.href,
    },
  });
}
