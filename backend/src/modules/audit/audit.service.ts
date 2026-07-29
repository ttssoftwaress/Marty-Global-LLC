import type { Prisma } from '@prisma/client';

import type { AuthContext } from '../../guards/auth-context.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

/*
 * The audit trail. AGENTS.md: "Every state change on companies, registrations,
 * billing, payments, and documents writes an audit entry through the `audit`
 * module." Every admin write in this codebase calls `record` — it is the one
 * layer touching AuditLog.
 *
 * Two rules shape this file:
 *
 * 1. An audit write must never fail the operation it is describing. A trail is
 *    evidence, not a precondition — losing the row is bad, refusing the payment
 *    the row describes is worse. So `record` swallows and logs its own failure,
 *    and callers do not await it inside their transaction.
 *
 * 2. Metadata never carries PII or card data (AGENTS.md, Security & PII). What
 *    goes in is what changed — a status, an amount in minor units, a set of
 *    permission keys — never a name, address, message body, or PAN.
 */

export const AuditAction = {
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_ASSIGNED: 'order.assigned',
  ORDER_ACTIVITY_ADDED: 'order.activity_added',
  /*
   * The one READ in this table, and deliberately so. Everything else here is a
   * state change; this is a staff member opening a file the customer uploaded —
   * a passport, a proof of address, a tax form. Who looked at a customer's
   * identity documents and when is precisely the question an audit trail exists
   * to answer, and nothing about the document row records it. The metadata
   * carries ids and which way it was served, never the filename (which is the
   * customer's own words and routinely names them).
   */
  ORDER_DOCUMENT_ACCESSED: 'order.document_accessed',
  /*
   * Staff asking the customer to upload something. Recorded because it is the
   * start of a request for identity paperwork and explains why a customer was
   * emailed — the metadata carries the row id, never the requested name, which
   * is free text a reviewer typed and can name the document's holder.
   */
  ORDER_DOCUMENT_REQUESTED: 'order.document_requested',
  QUOTE_SENT: 'billing.quote_sent',
  QUOTE_CANCELLED: 'billing.quote_cancelled',
  SERVICE_CREATED: 'catalog.service_created',
  SERVICE_UPDATED: 'catalog.service_updated',
  /*
   * Removing a service from the catalog. Only ever reaches this for a service
   * nothing was ordered or delivered under — anything else is deactivated — and
   * even then it is `deletedAt`, not a row disappearing.
   */
  SERVICE_DELETED: 'catalog.service_deleted',
  // The field registry. Registering or re-shaping a question changes what every
  // service asking it collects, so each write is audited like any other catalog
  // change (AGENTS.md).
  FIELD_CREATED: 'catalog.field_created',
  FIELD_UPDATED: 'catalog.field_updated',
  // Removing a registered question outright. Only ever succeeds for one nothing
  // has ever referenced — a field an order holds an answer for is archived.
  FIELD_DELETED: 'catalog.field_deleted',
  // The result registry and the per-service delivery schema — the mirror of the
  // two above. Reshaping what a service RETURNS changes every record delivered
  // under it, so each write is audited like any other catalog change.
  RESULT_FIELD_CREATED: 'catalog.result_field_created',
  RESULT_FIELD_UPDATED: 'catalog.result_field_updated',
  RESULT_FIELD_DELETED: 'catalog.result_field_deleted',
  RESULT_SCHEMA_UPDATED: 'catalog.result_schema_updated',
  REQUEST_TYPE_CREATED: 'catalog.request_type_created',
  REQUEST_TYPE_UPDATED: 'catalog.request_type_updated',
  /*
   * Service delivery. A result is a customer-facing record of a filing, so
   * creating one and every later edit to it is a state change AGENTS.md requires
   * a trail for — the metadata carries ids and which field keys changed, never
   * the values themselves (they are the customer's own data).
   */
  RESULT_DELIVERED: 'delivery.result_delivered',
  RESULT_UPDATED: 'delivery.result_updated',
  RESULT_STATUS_CHANGED: 'delivery.result_status_changed',
  /*
   * The second READ in this table, and there for the same reason as
   * ORDER_DOCUMENT_ACCESSED above: a delivered record's file is a certificate or
   * a registration document belonging to the customer, and staff opening one is
   * an access nothing else records. Metadata carries the field key and ids —
   * never the document's name or any value on the record.
   */
  RESULT_FILE_ACCESSED: 'delivery.result_file_accessed',
  ORDER_ITEM_STATUS_CHANGED: 'delivery.order_item_status_changed',
  SERVICE_REQUEST_STATUS_CHANGED: 'delivery.request_status_changed',
  SERVICE_REQUEST_ASSIGNED: 'delivery.request_assigned',
  PAYMENT_REMINDER_SENT: 'payment.reminder_sent',
  // USDT (TRC-20) collection. Every state change on a payment is audited
  // (AGENTS.md, Backend) — the metadata carries ids, a status, and minor units,
  // never a name or an address book entry.
  PAYMENT_INTENT_CREATED: 'payment.intent_created',
  // The customer closing their own payment window from the checkout screen. The
  // one payment state change with a customer as the actor, which is precisely why
  // it needs a trail — it frees the watched amount for reuse.
  PAYMENT_CANCELLED: 'payment.cancelled',
  PAYMENT_CREDITED: 'payment.credited',
  PAYMENT_MISMATCHED: 'payment.mismatched',
  PAYMENT_EXPIRED: 'payment.expired',
  // Closing out a transfer that arrived matching no payment. The only write in
  // the reconciliation queue, and the reason the queue can be trusted: what a
  // stray transfer turned out to be is a human's judgement, so it carries who
  // made it.
  UNMATCHED_TRANSFER_RESOLVED: 'payment.unmatched_transfer_resolved',
  // Opening a customer's mail room — written when delivering the virtual-mail
  // service provisions one.
  MAIL_ROOM_PROVISIONED: 'mailroom.room_provisioned',
  MAIL_SCAN_UPLOADED: 'mailroom.scan_uploaded',
  MAIL_REQUEST_CREATED: 'mailroom.request_created',
  MAIL_REQUEST_PROCESSED: 'mailroom.request_processed',
  MAIL_REQUEST_RESOLVED: 'mailroom.request_resolved',
  /*
   * Business settings — the reference data every other section picks from.
   * Retiring a location closes a jurisdiction to new orders and removes it from
   * every filter in the admin, so it is a state change with the same reach as a
   * catalog edit and carries the same trail.
   */
  LOCATION_CREATED: 'settings.location_created',
  LOCATION_UPDATED: 'settings.location_updated',
  LOCATION_DELETED: 'settings.location_deleted',
  LOCATIONS_REORDERED: 'settings.locations_reordered',
  CARRIER_CREATED: 'settings.carrier_created',
  CARRIER_UPDATED: 'settings.carrier_updated',
  CARRIER_DELETED: 'settings.carrier_deleted',
  CARRIERS_REORDERED: 'settings.carriers_reordered',
  STAFF_CREATED: 'team.member_created',
  STAFF_UPDATED: 'team.member_updated',
  STAFF_DELETED: 'team.member_deleted',
  CONVERSATION_ASSIGNED: 'support.conversation_assigned',
  CONVERSATION_STATUS_CHANGED: 'support.conversation_status_changed',
  /*
   * Authentication events, written by `audit.auth-hook.ts` from Better Auth's
   * own request lifecycle rather than by a service.
   *
   * They are here because every other entry in this table answers "who changed
   * this record", and none of them answer the question that comes first: who got
   * in, when, and from where. A trail showing an admin changed a member's role
   * is only evidence if it also shows that account signing in — otherwise a
   * stolen session and a legitimate one are indistinguishable after the fact.
   *
   * SIGN_IN_FAILED is the one entry written for something that did NOT happen,
   * and it is the most useful of the four: a burst of them against one account
   * is a credential-stuffing attempt, and the rate limiter's counters live in
   * Redis with a 15-minute window, so nothing else keeps that history.
   *
   * The metadata carries the reason and the auth method, never the submitted
   * password, and never the email — a failed attempt's address is an unverified
   * string from an anonymous caller, and storing it would fill the trail with
   * attacker-chosen PII (AGENTS.md, Security & PII). The actor id identifies the
   * account when one matched; when none did, that absence IS the finding.
   */
  SIGN_IN: 'auth.sign_in',
  SIGN_IN_FAILED: 'auth.sign_in_failed',
  SIGN_OUT: 'auth.sign_out',
  SIGN_UP: 'auth.sign_up',
  // Set, changed, or reset — see `audit.auth-hook.ts` for how the three are
  // told apart. Never carries the password, only which route changed it.
  PASSWORD_CHANGED: 'auth.password_changed',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  // A customer changing their own email moves the address every notification
  // and every reset link goes to, which makes it an account-takeover step worth
  // recording. The addresses themselves are PII and stay out of the metadata.
  EMAIL_CHANGED: 'auth.email_changed',
  /*
   * The authorization role on the user row — the only field the guards read
   * (lib/roles.ts). STAFF_UPDATED already records a team edit's role change, but
   * this fires wherever the column moves, including Better Auth's own admin
   * plugin routes, which never pass through the team service.
   */
  ROLE_CHANGED: 'auth.role_changed',
  // Better Auth's admin plugin can ban an account or revoke its sessions
  // out-of-band from the team screen. Same reasoning as ROLE_CHANGED.
  ACCOUNT_BANNED: 'auth.account_banned',
  ACCOUNT_UNBANNED: 'auth.account_unbanned',
  SESSIONS_REVOKED: 'auth.sessions_revoked',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

type RecordInput = {
  actor: AuthContext | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
};

export async function record({
  actor,
  action,
  entityType,
  entityId,
  metadata,
  ipAddress,
}: RecordInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        // Null actor is a system/job write, which the schema allows.
        actorId: actor?.userId ?? null,
        actorRole: actor?.role ?? null,
        action,
        entityType,
        entityId,
        ...(metadata === undefined ? {} : { metadata }),
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (error) {
    // See rule 1 above: never let the trail break the operation.
    logger.error({ err: error, action, entityType, entityId }, 'Audit write failed');
  }
}
