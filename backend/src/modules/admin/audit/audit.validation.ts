import { z } from 'zod';

/*
 * The admin audit log wire contract. Mirrors `frontend/src/admin/types/audit.ts`.
 *
 * The category and action vocabularies are published by `GET /admin/audit/summary`
 * and never accepted as a closed enum here — `action` and `category` arrive as
 * free strings and are matched against the catalogue in the service. Two reasons:
 * the table holds historical rows whose action may no longer be in the current
 * catalogue (a retired verb still has to be filterable), and pinning the enum
 * here would mean every new audited event needed this file edited as well as
 * `audit.service.ts`, which is exactly the drift a second list invites.
 */

export const listAuditQuerySchema = z
  .object({
    // A category key from the summary, or `all`. Categories group the dotted
    // action prefixes ("auth", "payment") into the sections the screen tabs on.
    category: z.string().trim().min(1).max(40).default('all'),
    // A single action verb ("auth.sign_in_failed") — narrower than a category,
    // and what the screen switches to when an admin drills into one row's kind.
    action: z.string().trim().min(1).max(80).optional(),
    // The staff or customer account that acted. A cuid from a row, never typed.
    actorId: z.string().trim().min(1).max(60).optional(),
    // What was acted ON: model name plus row id. Both or neither — see the
    // refine below.
    entityType: z.string().trim().min(1).max(60).optional(),
    entityId: z.string().trim().min(1).max(60).optional(),
    /*
     * Free text over the action verb only. Deliberately not over metadata: that
     * column is JSON whose contents vary per action, a `contains` across it
     * would be an unindexed scan of the largest column in the table, and it is
     * the one place an attacker-influenced string could land (a failed sign-in's
     * recorded reason).
     */
    search: z.string().trim().max(120).optional(),
    /*
     * The window, as ISO-8601 instants. Inclusive `from`, exclusive `to` — the
     * frontend sends a day boundary in the viewer's zone, and a half-open
     * interval is the only shape where "today" neither drops nor double-counts
     * the midnight row (AGENTS.md, Dates: the browser owns the zone conversion).
     */
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  /*
   * An entity id without its type is ambiguous across tables — two models can
   * hold the same cuid — and the schema's index is on the pair. Refusing the
   * half-filled filter is better than silently widening it to every model, which
   * is what ignoring the lone value would do.
   */
  .refine((value) => Boolean(value.entityType) === Boolean(value.entityId), {
    message: 'entityType and entityId must be sent together',
    path: ['entityId'],
  })
  /*
   * A backwards window returns nothing, which reads on screen as "no activity"
   * rather than as the mistake it is. Cheaper to refuse it here than to let an
   * admin conclude the trail is empty.
   */
  .refine((value) => !value.from || !value.to || value.from < value.to, {
    message: '`from` must be before `to`',
    path: ['to'],
  });

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;
