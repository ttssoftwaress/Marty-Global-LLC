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
  /*
   * The customer's side of the same exchange: a file landing on their order,
   * either answering an outstanding request or arriving unprompted. A document
   * appearing on an order is a state change on a document, which AGENTS.md
   * requires a trail for, and it is the other half of the identity-paperwork
   * story the two actions above tell — who asked, and who opened it, but until
   * now not who supplied it. Metadata carries ids and a count, never the
   * filename (the customer's own words, and routinely their name).
   */
  ORDER_DOCUMENT_UPLOADED: 'order.document_uploaded',
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
  /*
   * The follow-up actions a service offers. One verb for the whole list, not a
   * created/updated/deleted trio like the two registries above, because the
   * admin edits them as a batch: a single PUT submits the full list and the
   * service upserts every entry, so "created" and "updated" happen in the same
   * write and splitting them would file two rows for one action. Which keys
   * appeared and which stopped being offered rides in the metadata instead.
   */
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
  /*
   * Wire transfers. Nothing watches a bank account, so these three are the whole
   * trail a manually-settled payment leaves — which makes them the most
   * important entries in this table.
   *
   * MARKED_SENT is the customer's claim, not a settlement: it only moves the
   * payment up the team's queue. SETTLED_MANUALLY is a person declaring that
   * money we cannot see arrived, and is the one payment credit in the system
   * with a human actor rather than a job — so it carries who, when, and the note
   * they left. REJECTED is the same decision the other way.
   */
  PAYMENT_MARKED_SENT: 'payment.marked_sent',
  PAYMENT_SETTLED_MANUALLY: 'payment.settled_manually',
  PAYMENT_SETTLEMENT_REJECTED: 'payment.settlement_rejected',
  /*
   * Payment configuration — the deposit address, the USD→USDT rate, the
   * confirmation depth, and the bank accounts customers wire to.
   *
   * Audited with the same weight as a role change, because that is what these
   * are: changing the receiving address decides where every future payment
   * lands, and changing a bank account's IBAN decides it for wires. The metadata
   * names WHICH fields changed and never their values — an account number is not
   * going in the trail (AGENTS.md, Security & PII).
   */
  PAYMENT_SETTINGS_UPDATED: 'settings.payment_settings_updated',
  BANK_ACCOUNT_CREATED: 'settings.bank_account_created',
  BANK_ACCOUNT_UPDATED: 'settings.bank_account_updated',
  BANK_ACCOUNT_DELETED: 'settings.bank_account_deleted',
  BANK_ACCOUNTS_REORDERED: 'settings.bank_accounts_reordered',
  // Money arrived that matches no payment we are watching. Written once, on the
  // first sighting — the poller re-reads its overlap window and would otherwise
  // file the same finding on every sweep.
  UNMATCHED_TRANSFER_RECORDED: 'payment.unmatched_transfer_recorded',
  // Closing out a transfer that arrived matching no payment. The only write in
  // the reconciliation queue, and the reason the queue can be trusted: what a
  // stray transfer turned out to be is a human's judgement, so it carries who
  // made it.
  UNMATCHED_TRANSFER_RESOLVED: 'payment.unmatched_transfer_resolved',
  // Opening a customer's mail room — written when delivering the virtual-mail
  // service provisions one.
  MAIL_ROOM_PROVISIONED: 'mailroom.room_provisioned',
  MAIL_SCAN_UPLOADED: 'mailroom.scan_uploaded',
  /*
   * Opening a sealed envelope and scanning what was inside it. Separate from
   * filing the envelope above, because it is the moment a document nobody had
   * read became readable — the one step in the mail flow a customer might later
   * ask us to account for, and the trail has to name who took it.
   */
  MAIL_CONTENTS_SCANNED: 'mailroom.contents_scanned',
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
  /*
   * Outbound email switched on or off. Carries its value, unlike the payment
   * settings above: the switch is not sensitive, and "was the system sending
   * email at all that week" is exactly the question asked weeks later when a
   * customer says nobody told them. The metadata never names a recipient.
   */
  NOTIFICATION_SETTINGS_UPDATED: 'settings.notification_settings_updated',
  STAFF_CREATED: 'team.member_created',
  STAFF_UPDATED: 'team.member_updated',
  STAFF_DELETED: 'team.member_deleted',
  /*
   * A job role's own definition. Separate from the three above because the blast
   * radius is different in kind: editing a member changes one account, while
   * editing a role changes every account holding it at once — which is the whole
   * reason roles exist and the reason this needs its own row in the trail.
   */
  STAFF_ROLE_CREATED: 'team.role_created',
  STAFF_ROLE_UPDATED: 'team.role_updated',
  STAFF_ROLE_DELETED: 'team.role_deleted',
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
