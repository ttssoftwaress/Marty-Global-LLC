import type { Prisma } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { prisma } from '../../../lib/prisma.js';
import type { PermissionKey } from '../../../lib/permissions.js';
import { fieldDeletionBlocker } from '../fields/fields.service.js';
import { resultFieldDeletionBlocker } from '../result-fields/result-fields.service.js';

/*
 * The catalogue of what can be deleted, and everything the generic engine needs
 * to know about each entity to do it.
 *
 * `trash.service.ts` contains no per-entity knowledge at all — it deletes,
 * restores, and purges whatever this file describes. That split is the point:
 * adding a table to the trash is one entry here, not a new endpoint, and the
 * rules that decide whether a row MAY go (a service on a customer's order, a
 * role somebody still holds) live beside the entity they belong to rather than
 * being re-typed at each call site.
 *
 * WHAT AN ENTRY OWES
 *
 *   `permission`  which admin area a member must hold to delete, see, or restore
 *                 this kind of row. Checked in addition to `data.delete` on the
 *                 way in and `trash` on the way out — holding the bin's own
 *                 grant never widens what is in it.
 *   `label`       what the trash screen prints. Snapshotted at delete time,
 *                 because after a purge there is nothing left to join to.
 *   `guard`       why this particular row may NOT be deleted, as a sentence the
 *                 admin reads. Returning a string refuses; returning null allows.
 *   `dependents`  the rows that have to go with it — see the cascade note below.
 *
 * THE CASCADE
 *
 *   Deleting a customer that leaves their orders behind is not a delete; it is
 *   five other admin tables now listing rows attached to somebody who is gone.
 *   So an entry declares its dependents, the engine walks them transitively
 *   through this same registry, and the ids it actually changed are recorded on
 *   the trash entry so a restore puts back exactly that set.
 *
 *   `dependents` returns ids only. It must not filter on `deletedAt` — the
 *   engine does that, because "was this row already deleted before the click"
 *   is precisely the distinction restore depends on, and it is the engine that
 *   holds it.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 *   `AuditLog`. It is the evidence a deletion happened; a delete button over it
 *   erases its own record, and the audit module offers no write path by design.
 *
 *   Rows that are not independently listed anywhere — an order's items, a
 *   quote's line items, a message's attachments, a scan's pages. They are only
 *   ever read through a parent that IS listed, so trashing the parent already
 *   removes them from every screen, and giving each its own entry would offer an
 *   admin a way to gut a record from the inside.
 */

// --- The delegate shim ---------------------------------------------------

/*
 * Prisma generates a differently-typed delegate per model — `where` on Order is
 * not `where` on Region — so a generic engine cannot name them all without 25
 * parallel copies of the same three statements.
 *
 * This is the one narrowing in the feature, and it is deliberately confined to
 * four method signatures over `object`, with the real types re-imposed at every
 * call site: each entry below writes its own Prisma-typed `where` clauses, and
 * the id column each table is keyed by is declared in `idField` rather than
 * assumed. Nothing downstream of this file sees `object`.
 */
type Row = Record<string, unknown>;

type Delegate = {
  findMany(args: { where: object; select: object }): Promise<Row[]>;
  updateMany(args: {
    where: object;
    data: { deletedAt: Date | null };
  }): Promise<{ count: number }>;
  deleteMany(args: { where: object }): Promise<{ count: number }>;
  count(args: { where: object }): Promise<number>;
};

const delegates = prisma as unknown as Record<string, Delegate>;

// --- Entity keys ---------------------------------------------------------

/*
 * Stable slugs, and the wire vocabulary both apps speak. Deliberately not the
 * Prisma model names: renaming a model would otherwise be a data migration over
 * every `trash_entry.entityType` already written.
 */
export const TRASH_ENTITIES = [
  'order',
  'order-document',
  'customer',
  'quote',
  'payment',
  'unmatched-transfer',
  'bank-account',
  'service',
  'pricing-tier',
  'request-type',
  'field',
  'result-field',
  'record',
  'service-request',
  'mail-room',
  'mail-item',
  'mail-request',
  'mail-log',
  'carrier',
  'location',
  'conversation',
  'message',
  'staff-member',
  'staff-role',
  'lead',
] as const;

export type TrashEntityKey = (typeof TRASH_ENTITIES)[number];

const ENTITY_SET: ReadonlySet<string> = new Set(TRASH_ENTITIES);

export function isTrashEntityKey(value: unknown): value is TrashEntityKey {
  return typeof value === 'string' && ENTITY_SET.has(value);
}

// --- The descriptor ------------------------------------------------------

export type TrashLabel = { label: string; sublabel?: string };

export type TrashDependents = { entity: TrashEntityKey; ids: string[] };

export type TrashDescriptor = {
  key: TrashEntityKey;
  // The Prisma delegate's property name on the client — "order", "mailRoom".
  model: string;
  // Which column holds the id. Two tables are keyed by their own code.
  idField: 'id' | 'code' | 'userId';
  // Singular and plural, for the trash screen's type filter and its confirm copy.
  label: string;
  pluralLabel: string;
  // The admin area that governs this kind of row.
  permission: PermissionKey;
  /*
   * Deleting this kind of row takes an administrator, not merely the area plus
   * `data.delete`. Reserved for rows that hand out access or hold money's
   * configuration — the same posture their own screens already take.
   */
  adminOnly?: boolean;
  // The columns `describe` reads. Kept minimal: the label is a display string,
  // never a payload.
  select: object;
  describe(row: Row): TrashLabel;
  /*
   * A sentence explaining why this row may not go, or null to allow it.
   *
   * `actor` is passed because two of the rules are about WHO is deleting rather
   * than what — an admin deleting their own staff account is the fastest way to
   * strand an org, and it is not a fact about the row.
   */
  guard?(id: string, row: Row, actor: AuthContext): Promise<string | null>;
  // Rows this delete must take with it. Ids only — see the cascade note above.
  dependents?(ids: string[]): Promise<TrashDependents[]>;
  /*
   * Extra work beyond stamping `deletedAt`, and its exact inverse. Only two
   * entities need them, and both say why on the entry itself. A descriptor
   * without them is a plain soft delete, which is the case that must stay
   * boring.
   */
  onDelete?(ids: string[]): Promise<void>;
  onRestore?(ids: string[]): Promise<void>;
  /*
   * Refuse the permanent delete, leaving the row in the bin with the reason.
   * Distinct from `guard`, which refuses the move INTO the bin: a staff account
   * that owns customer records may be revoked but must never be dropped, and
   * that only becomes true at purge time.
   */
  purgeGuard?(id: string): Promise<string | null>;
};

// --- Small helpers -------------------------------------------------------

const text = (row: Row, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

// A dependent set, dropped entirely when it is empty so the recorded cascade
// carries no empty groups to read past.
const dependsOn = (
  ...groups: (TrashDependents | undefined)[]
): TrashDependents[] =>
  groups.filter(
    (group): group is TrashDependents => group !== undefined && group.ids.length > 0,
  );

const idsOf = (rows: { id: string }[]): string[] => rows.map((row) => row.id);

// --- The registry --------------------------------------------------------

const DESCRIPTORS: Record<TrashEntityKey, TrashDescriptor> = {
  // --- Orders ------------------------------------------------------------
  order: {
    key: 'order',
    model: 'order',
    idField: 'id',
    label: 'Order',
    pluralLabel: 'Orders',
    permission: 'orders',
    select: { reference: true, customer: { select: { name: true } } },
    describe: (row) => {
      const customer = row.customer as Row | null;
      return {
        label: text(row, 'reference') ?? 'Order',
        ...(customer && typeof customer.name === 'string'
          ? { sublabel: customer.name }
          : {}),
      };
    },
    /*
     * The quotes and payments raised against an order go with it, and that is
     * the whole reason the cascade is recorded rather than left to each screen's
     * own filter: a payment whose order has vanished still shows in the ledger,
     * still counts toward revenue, and still has a "view order" link that 404s.
     *
     * Documents, activity, and items are NOT here — they are read only through
     * the order, which no query reaches any more.
     */
    dependents: async (ids) => {
      const [quotes, conversations, results] = await Promise.all([
        prisma.quote.findMany({ where: { orderId: { in: ids } }, select: { id: true } }),
        prisma.conversation.findMany({
          where: { orderId: { in: ids } },
          select: { id: true },
        }),
        prisma.serviceResult.findMany({
          where: { orderId: { in: ids } },
          select: { id: true },
        }),
      ]);

      return dependsOn(
        { entity: 'quote', ids: idsOf(quotes) },
        { entity: 'conversation', ids: idsOf(conversations) },
        { entity: 'record', ids: idsOf(results) },
      );
    },
  },

  'order-document': {
    key: 'order-document',
    model: 'orderDocument',
    idField: 'id',
    label: 'Order document',
    pluralLabel: 'Order documents',
    permission: 'orders',
    select: { name: true, order: { select: { reference: true } } },
    describe: (row) => {
      const order = row.order as Row | null;
      return {
        label: text(row, 'name') ?? 'Document',
        ...(order && typeof order.reference === 'string'
          ? { sublabel: order.reference }
          : {}),
      };
    },
  },

  // --- Customers ---------------------------------------------------------
  customer: {
    key: 'customer',
    model: 'user',
    idField: 'id',
    label: 'Customer',
    pluralLabel: 'Customers',
    permission: 'customers',
    select: { name: true, email: true, role: true },
    describe: (row) => ({
      label: text(row, 'name') ?? 'Customer',
      ...(text(row, 'email') ? { sublabel: row.email as string } : {}),
    }),
    /*
     * A staff account is not a customer row, and deleting one from the customer
     * list would take a colleague's access with it while filing an entry the
     * team screen never shows. Staff are removed from Team & staff, which is its
     * own entry below with its own rules.
     */
    guard: async (_id, row) => {
      const role = text(row, 'role');
      return role && role !== 'customer'
        ? 'This account is a staff member. Remove it from Team & staff instead — deleting it here would take their access with it.'
        : null;
    },
    /*
     * Everything the account owns, because every one of them is listed on
     * another admin screen: orders in the queue, quotes and payments in the
     * ledger, mail rooms in virtual mail ops, threads in the support inbox.
     *
     * `company` and `profile` are not here. They are one-to-one satellites read
     * only through the customer, and the account row itself is what every screen
     * filters on.
     */
    dependents: async (ids) => {
      const [orders, quotes, payments, rooms, conversations, results, requests] =
        await Promise.all([
          prisma.order.findMany({
            where: { customerId: { in: ids } },
            select: { id: true },
          }),
          prisma.quote.findMany({
            where: { customerId: { in: ids } },
            select: { id: true },
          }),
          prisma.payment.findMany({
            where: { customerId: { in: ids } },
            select: { id: true },
          }),
          prisma.mailRoom.findMany({
            where: { customerId: { in: ids } },
            select: { id: true },
          }),
          prisma.conversation.findMany({
            where: { customerId: { in: ids } },
            select: { id: true },
          }),
          prisma.serviceResult.findMany({
            where: { customerId: { in: ids } },
            select: { id: true },
          }),
          prisma.serviceRequest.findMany({
            where: { customerId: { in: ids } },
            select: { id: true },
          }),
        ]);

      return dependsOn(
        { entity: 'order', ids: idsOf(orders) },
        { entity: 'quote', ids: idsOf(quotes) },
        { entity: 'payment', ids: idsOf(payments) },
        { entity: 'mail-room', ids: idsOf(rooms) },
        { entity: 'conversation', ids: idsOf(conversations) },
        { entity: 'record', ids: idsOf(results) },
        { entity: 'service-request', ids: idsOf(requests) },
      );
    },
  },

  // --- Billing -----------------------------------------------------------
  quote: {
    key: 'quote',
    model: 'quote',
    idField: 'id',
    label: 'Quote',
    pluralLabel: 'Quotes',
    permission: 'payments',
    select: { reference: true, serviceName: true },
    describe: (row) => ({
      label: text(row, 'reference') ?? 'Quote',
      ...(text(row, 'serviceName') ? { sublabel: row.serviceName as string } : {}),
    }),
    // The collection attempts against it. A payment outliving its quote is a
    // ledger row with nothing to reconcile against.
    dependents: async (ids) => {
      const payments = await prisma.payment.findMany({
        where: { quoteId: { in: ids } },
        select: { id: true },
      });
      return dependsOn({ entity: 'payment', ids: idsOf(payments) });
    },
  },

  payment: {
    key: 'payment',
    model: 'payment',
    idField: 'id',
    label: 'Payment',
    pluralLabel: 'Payments',
    permission: 'payments',
    select: { provider: true, status: true, quote: { select: { reference: true } } },
    describe: (row) => {
      const quote = row.quote as Row | null;
      const reference =
        quote && typeof quote.reference === 'string' ? quote.reference : null;
      return {
        label: reference ? `Payment for ${reference}` : 'Payment',
        ...(text(row, 'status') ? { sublabel: row.status as string } : {}),
      };
    },
    /*
     * A credited payment is money we have taken and told the customer we have
     * taken. Removing it from the ledger makes the invoice it settled look
     * unpaid, and the quote it credited would start chasing the customer again —
     * so it is refused outright rather than made undoable.
     *
     * Cancel or reject the payment instead; both are states the ledger models,
     * and both leave a row that says what happened.
     */
    guard: async (_id, row) =>
      text(row, 'status') === 'SUCCEEDED'
        ? 'This payment has been credited, so it cannot be deleted — the invoice it settled would read as unpaid. Money already taken stays on the ledger.'
        : null,
  },

  'unmatched-transfer': {
    key: 'unmatched-transfer',
    model: 'unmatchedTransfer',
    idField: 'id',
    label: 'Unmatched transfer',
    pluralLabel: 'Unmatched transfers',
    permission: 'payments',
    select: { transactionHash: true, fromAddress: true },
    describe: (row) => {
      const hash = text(row, 'transactionHash') ?? '';
      return {
        label: hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : 'Transfer',
        sublabel: 'Unattributed USDT transfer',
      };
    },
    /*
     * Worth stating on the entry itself: this hides the row, it does not undo
     * the transfer. The poller re-reads its overlap window and its upsert
     * ignores `deletedAt`, so money that is still arriving will re-surface. The
     * disposal that sticks is resolving it with a note, which is what the queue
     * is for.
     */
  },

  'bank-account': {
    key: 'bank-account',
    model: 'bankAccount',
    idField: 'id',
    label: 'Bank account',
    pluralLabel: 'Bank accounts',
    permission: 'payments',
    // Where money is sent. Same posture as its own screen, which narrows to an
    // administrator for every write.
    adminOnly: true,
    select: { label: true, currency: true },
    describe: (row) => ({
      label: text(row, 'label') ?? 'Bank account',
      ...(text(row, 'currency') ? { sublabel: row.currency as string } : {}),
    }),
    /*
     * An account money was actually collected through is retired, never removed.
     * The payments that came in on it store its id, and dropping the row would
     * null every one of those links — which is the reconciliation trail for a
     * wire, the one payment kind with no chain behind it. The instructions on
     * each payment are snapshotted, so nothing a customer was shown changes; the
     * link is what would be lost.
     *
     * A `purgeGuard` rather than a `guard`, deliberately: closing an account is
     * ordinary and should be a click. It is only the permanent removal thirty
     * days later that has to be refused.
     */
    purgeGuard: async (id) => {
      const payments = await prisma.payment.count({ where: { bankAccountId: id } });

      return payments === 0
        ? null
        : `${payments} payment${payments === 1 ? ' was' : 's were'} collected through this account, so the row stays — retired rather than removed.`;
    },
  },

  // --- Catalog -----------------------------------------------------------
  service: {
    key: 'service',
    model: 'service',
    idField: 'id',
    label: 'Service',
    pluralLabel: 'Services',
    permission: 'catalog',
    select: { name: true },
    describe: (row) => ({ label: text(row, 'name') ?? 'Service' }),
    /*
     * The catalog's own rule, unchanged and now enforced from one place: a
     * service a customer has bought is part of that order's history, so it is
     * deactivated rather than deleted.
     */
    guard: async (id, row) => {
      const [orderItems, results] = await Promise.all([
        prisma.orderItem.count({ where: { serviceId: id } }),
        prisma.serviceResult.count({ where: { serviceId: id } }),
      ]);

      const references = orderItems + results;
      if (references === 0) return null;

      const name = text(row, 'name') ?? 'This service';
      return `"${name}" is on ${references} customer record${references === 1 ? '' : 's'}, so it cannot be deleted. Turn it off instead — it stays on those records and disappears from the customer's catalog.`;
    },
    // Tiers and request types are only ever read through the service, so they
    // are left untouched — which is also what keeps a restore lossless.
  },

  'pricing-tier': {
    key: 'pricing-tier',
    model: 'servicePricingTier',
    idField: 'id',
    label: 'Pricing tier',
    pluralLabel: 'Pricing tiers',
    permission: 'catalog',
    select: { name: true, service: { select: { name: true } } },
    describe: (row) => {
      const service = row.service as Row | null;
      return {
        label: text(row, 'name') ?? 'Pricing tier',
        ...(service && typeof service.name === 'string'
          ? { sublabel: service.name }
          : {}),
      };
    },
  },

  'request-type': {
    key: 'request-type',
    model: 'serviceRequestType',
    idField: 'id',
    label: 'Request type',
    pluralLabel: 'Request types',
    permission: 'catalog',
    select: { label: true, service: { select: { name: true } } },
    describe: (row) => {
      const service = row.service as Row | null;
      return {
        label: text(row, 'label') ?? 'Request type',
        ...(service && typeof service.name === 'string'
          ? { sublabel: service.name }
          : {}),
      };
    },
    // Requests already raised under it must stay readable, which is what the FK
    // enforces too — `ServiceRequest.requestType` is `Restrict`.
    guard: async (id) => {
      const raised = await prisma.serviceRequest.count({ where: { requestTypeId: id } });
      return raised === 0
        ? null
        : `${raised} customer request${raised === 1 ? ' was' : 's were'} raised under this type, so it cannot be deleted. Switch it off instead — it leaves the customer's page and those requests keep reading correctly.`;
    },
  },

  field: {
    key: 'field',
    model: 'fieldDefinition',
    idField: 'id',
    label: 'Form field',
    pluralLabel: 'Form fields',
    permission: 'catalog',
    select: { label: true, key: true },
    describe: (row) => ({
      label: text(row, 'label') ?? 'Form field',
      ...(text(row, 'key') ? { sublabel: row.key as string } : {}),
    }),
    /*
     * The rule lives in `fields.service.ts`, which is the one place that knows
     * every way a key can be referenced — a service form, a wizard step, a
     * request type's intake, a stored answer, and a dependent dropdown reading
     * this field's value. This entry defers to it rather than keeping a second,
     * thinner copy that would drift the first time a fifth reference is added.
     *
     * The import runs one way: fields never imports the trash. That is what lets
     * the delete route point at the trash controller while the guard stays here.
     */
    guard: (id) => fieldDeletionBlocker(id),
  },

  'result-field': {
    key: 'result-field',
    model: 'resultFieldDefinition',
    idField: 'id',
    label: 'Result field',
    pluralLabel: 'Result fields',
    permission: 'catalog',
    select: { label: true, key: true },
    describe: (row) => ({
      label: text(row, 'label') ?? 'Result field',
      ...(text(row, 'key') ? { sublabel: row.key as string } : {}),
    }),
    /*
     * Deferred to `result-fields.service.ts` for the same reason the request
     * registry's guard is: there are two ways a definition can be referenced —
     * a service still returning it, and a delivered record holding a value for
     * it — and that file is the one place that knows both. A `Restrict` foreign
     * key from `ServiceResultValue` enforces the second at the database level;
     * this is what turns it into a sentence rather than a constraint error.
     */
    guard: (id) => resultFieldDeletionBlocker(id),
  },

  // --- Service delivery --------------------------------------------------
  record: {
    key: 'record',
    model: 'serviceResult',
    idField: 'id',
    label: 'Delivered record',
    pluralLabel: 'Delivered records',
    permission: 'requests',
    select: { reference: true, title: true },
    describe: (row) => ({
      label: text(row, 'title') ?? text(row, 'reference') ?? 'Record',
      ...(text(row, 'reference') ? { sublabel: row.reference as string } : {}),
    }),
    // Follow-ups are raised against the record and shown in the same queue, so
    // they go with it.
    dependents: async (ids) => {
      const requests = await prisma.serviceRequest.findMany({
        where: { resultId: { in: ids } },
        select: { id: true },
      });
      return dependsOn({ entity: 'service-request', ids: idsOf(requests) });
    },
  },

  'service-request': {
    key: 'service-request',
    model: 'serviceRequest',
    idField: 'id',
    label: 'Service request',
    pluralLabel: 'Service requests',
    permission: 'requests',
    select: { reference: true, typeLabel: true },
    describe: (row) => ({
      label: text(row, 'reference') ?? 'Request',
      ...(text(row, 'typeLabel') ? { sublabel: row.typeLabel as string } : {}),
    }),
  },

  // --- Virtual mail ------------------------------------------------------
  'mail-room': {
    key: 'mail-room',
    model: 'mailRoom',
    idField: 'id',
    label: 'Mail room',
    pluralLabel: 'Mail rooms',
    permission: 'mailroom',
    select: { name: true, address: true },
    describe: (row) => ({
      label: text(row, 'name') ?? 'Mail room',
      ...(text(row, 'address') ? { sublabel: row.address as string } : {}),
    }),
    dependents: async (ids) => {
      const items = await prisma.mailItem.findMany({
        where: { roomId: { in: ids } },
        select: { id: true },
      });
      return dependsOn({ entity: 'mail-item', ids: idsOf(items) });
    },
  },

  'mail-item': {
    key: 'mail-item',
    model: 'mailItem',
    idField: 'id',
    label: 'Mail item',
    pluralLabel: 'Mail items',
    permission: 'mailroom',
    select: { sender: true, room: { select: { name: true } } },
    describe: (row) => {
      const room = row.room as Row | null;
      return {
        label: text(row, 'sender') ?? 'Mail item',
        ...(room && typeof room.name === 'string' ? { sublabel: room.name } : {}),
      };
    },
    // The requests raised on it and the log entries that closed it — both are
    // listed on their own tabs of the mail-ops screen.
    dependents: async (ids) => {
      const [requests, logs] = await Promise.all([
        prisma.mailRequest.findMany({
          where: { mailItemId: { in: ids } },
          select: { id: true },
        }),
        prisma.mailActionLog.findMany({
          where: { mailItemId: { in: ids } },
          select: { id: true },
        }),
      ]);

      return dependsOn(
        { entity: 'mail-request', ids: idsOf(requests) },
        { entity: 'mail-log', ids: idsOf(logs) },
      );
    },
  },

  'mail-request': {
    key: 'mail-request',
    model: 'mailRequest',
    idField: 'id',
    label: 'Mail request',
    pluralLabel: 'Mail requests',
    permission: 'mailroom',
    select: { type: true, status: true },
    describe: (row) => ({
      label: `${text(row, 'type') ?? 'Mail'} request`,
      ...(text(row, 'status') ? { sublabel: row.status as string } : {}),
    }),
  },

  'mail-log': {
    key: 'mail-log',
    model: 'mailActionLog',
    idField: 'id',
    label: 'Mail log entry',
    pluralLabel: 'Mail log entries',
    permission: 'mailroom',
    select: { action: true, mailItemLabel: true },
    describe: (row) => ({
      label: text(row, 'mailItemLabel') ?? 'Mail log entry',
      ...(text(row, 'action') ? { sublabel: row.action as string } : {}),
    }),
  },

  carrier: {
    key: 'carrier',
    model: 'mailCarrier',
    idField: 'code',
    label: 'Mail carrier',
    pluralLabel: 'Mail carriers',
    permission: 'settings',
    select: { code: true, label: true },
    describe: (row) => ({
      label: text(row, 'label') ?? 'Carrier',
      ...(text(row, 'code') ? { sublabel: row.code as string } : {}),
    }),
    /*
     * No foreign key would stop this — the carrier is stored as free text on the
     * request — which is exactly why the check is here. Deleting a carrier
     * parcels shipped with would leave those requests printing a bare code where
     * a name used to be.
     */
    guard: async (code, row) => {
      const shipments = await prisma.mailRequest.count({ where: { carrier: code } });
      if (shipments === 0) return null;

      const label = text(row, 'label') ?? 'This carrier';
      return `"${label}" has shipped ${shipments} request${shipments === 1 ? '' : 's'}, so it cannot be deleted. Turn it off instead — past shipments keep its name and it disappears from the forwarding form.`;
    },
  },

  location: {
    key: 'location',
    model: 'region',
    idField: 'code',
    label: 'Location',
    pluralLabel: 'Locations',
    permission: 'settings',
    select: { code: true, label: true },
    describe: (row) => ({
      label: text(row, 'label') ?? 'Location',
      ...(text(row, 'code') ? { sublabel: row.code as string } : {}),
    }),
    // A location an order was filed under is part of that filing's record.
    guard: async (code, row) => {
      const [offerings, tiers, orders] = await Promise.all([
        prisma.serviceRegionOffering.count({ where: { regionCode: code } }),
        prisma.servicePricingTier.count({ where: { regionCode: code } }),
        prisma.order.count({ where: { regionCode: code } }),
      ]);

      const references = offerings + tiers + orders;
      if (references === 0) return null;

      const label = text(row, 'label') ?? 'This location';
      return `"${label}" is still referenced by ${references} record${references === 1 ? '' : 's'}, so it cannot be deleted. Turn it off instead — it stays on the records that use it and disappears from every picker.`;
    },
  },

  // --- Support -----------------------------------------------------------
  conversation: {
    key: 'conversation',
    model: 'conversation',
    idField: 'id',
    label: 'Conversation',
    pluralLabel: 'Conversations',
    permission: 'support',
    select: { subject: true, status: true },
    describe: (row) => ({
      label: text(row, 'subject') ?? 'Conversation',
      ...(text(row, 'status') ? { sublabel: row.status as string } : {}),
    }),
    // Messages are read only through the thread, so trashing the thread already
    // takes them off every screen. They stay untouched, which keeps the restore
    // exact — see the module note.
  },

  message: {
    key: 'message',
    model: 'message',
    idField: 'id',
    label: 'Message',
    pluralLabel: 'Messages',
    permission: 'support',
    select: { authorName: true, author: true },
    describe: (row) => ({
      // Never the body. A message is PII and the trash list is a screen, a log
      // line, and a purge confirmation away from it (AGENTS.md, Security & PII).
      label: `Message from ${text(row, 'authorName') ?? text(row, 'author') ?? 'unknown'}`,
    }),
  },

  // --- Team --------------------------------------------------------------
  /*
   * A staff account, keyed by `userId` rather than the profile's own id — that
   * is what every team endpoint already addresses a member by, and what the
   * audit trail records.
   *
   * Deleting one is not a plain soft delete, which is why this is one of the two
   * entries with `onDelete`/`onRestore`: the account has to be shut out the
   * moment it leaves the screen, not thirty days later when the purge runs. See
   * `revokeStaffAccess` below for what that means and what it deliberately does
   * NOT destroy.
   */
  'staff-member': {
    key: 'staff-member',
    model: 'staffProfile',
    idField: 'userId',
    label: 'Staff member',
    pluralLabel: 'Staff members',
    permission: 'team',
    adminOnly: true,
    select: { userId: true, roleKey: true, user: { select: { name: true, email: true } } },
    describe: (row) => {
      const user = row.user as Row | null;
      return {
        label:
          (user && typeof user.name === 'string' ? user.name : undefined) ??
          'Staff member',
        ...(user && typeof user.email === 'string' ? { sublabel: user.email } : {}),
      };
    },
    guard: async (userId, row, actor) => {
      // Same reasoning as the team screen's own guard: there is no undo through
      // the portal for locking yourself out, and the Trash is not one — the
      // restore button lives behind the access this would remove.
      if (userId === actor.userId) {
        return 'You cannot delete your own account.';
      }

      const authRole = await prisma.staffRole.findUnique({
        where: { key: text(row, 'roleKey') ?? '' },
        select: { authRole: true },
      });

      if (authRole?.authRole !== 'admin') return null;

      const otherAdmins = await prisma.staffProfile.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          userId: { not: userId },
          user: { is: { role: 'admin', deletedAt: null } },
        },
      });

      return otherAdmins === 0
        ? 'This is the last active admin — promote another before deleting this one.'
        : null;
    },
    onDelete: (ids) => revokeStaffAccess(ids, true),
    onRestore: (ids) => revokeStaffAccess(ids, false),
    /*
     * An account that owns customer records is revoked, never dropped: the
     * foreign keys from `user` cascade, so deleting the row would take orders,
     * quotes, and payments with it — records AGENTS.md puts under regulatory
     * retention. Today's team screen already refuses this; the purge inherits
     * the rule rather than routing around it.
     */
    purgeGuard: async (userId) => {
      const owned = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          company: { select: { id: true } },
          _count: {
            select: {
              orders: true,
              quotes: true,
              payments: true,
              mailRooms: true,
              serviceResults: true,
              serviceRequests: true,
              conversations: true,
            },
          },
        },
      });

      if (!owned) return null;

      const retains =
        owned.company !== null ||
        Object.values(owned._count).some((count) => count > 0);

      return retains
        ? 'This account owns customer records that carry retention, so the row stays — permanently revoked rather than removed.'
        : null;
    },
  },

  'staff-role': {
    key: 'staff-role',
    model: 'staffRole',
    idField: 'id',
    label: 'Staff role',
    pluralLabel: 'Staff roles',
    permission: 'team',
    adminOnly: true,
    select: { key: true, label: true, isSystem: true },
    describe: (row) => ({
      label: text(row, 'label') ?? 'Role',
      ...(text(row, 'key') ? { sublabel: row.key as string } : {}),
    }),
    guard: async (_id, row) => {
      if (row.isSystem === true) return 'A built-in role cannot be deleted.';

      /*
       * Refused rather than reassigned, which is also what the `Restrict`
       * foreign key enforces: the alternative is deciding on someone's behalf
       * which role a member lands on, and getting that wrong hands out access
       * nobody asked for. A soft-deleted profile counts — its row is retained
       * deliberately and would still break the constraint at purge time.
       */
      const members = await prisma.staffProfile.count({
        where: { roleKey: text(row, 'key') ?? '' },
      });

      return members === 0
        ? null
        : `${members} staff ${members === 1 ? 'account holds' : 'accounts hold'} this role — move them to another role before deleting it.`;
    },
  },

  // --- Marketing ---------------------------------------------------------
  lead: {
    key: 'lead',
    model: 'contactSubmission',
    idField: 'id',
    label: 'Lead',
    pluralLabel: 'Leads',
    permission: 'leads',
    select: { name: true, email: true },
    describe: (row) => ({
      label: text(row, 'name') ?? 'Lead',
      ...(text(row, 'email') ? { sublabel: row.email as string } : {}),
    }),
  },
};

/*
 * Shut a staff account out, and let it back in — the pair behind
 * `staff-member`'s `onDelete` / `onRestore`.
 *
 * Three locks close on delete, because each shuts a different door: the ban is
 * what Better Auth checks on sign-in and `require-auth.ts` re-checks per
 * request, the sessions are the cookies already issued, and `deletedAt` (stamped
 * by the engine, not here) is what removes them from the admin screens.
 *
 * What is deliberately NOT destroyed is the `Account` row — the credential.
 * Dropping it would leave nothing to restore: the member would come back unable
 * to sign in and needing a password reset, which is precisely the "as it was
 * before" this feature promises. It is destroyed at purge instead, along with
 * the rest of the row, where there is nothing left to promise.
 *
 * Sessions are not restored, and cannot be. A cookie issued before the deletion
 * has to be dead the moment access is revoked or the revocation means nothing;
 * the member signs in again, which is the one difference a restore leaves behind
 * and the only acceptable one.
 */
async function revokeStaffAccess(userIds: string[], revoke: boolean): Promise<void> {
  if (userIds.length === 0) return;

  await prisma.$transaction(async (tx) => {
    /*
     * `deletedAt` is set here rather than by the engine because the row this
     * descriptor is keyed to is the StaffProfile — the engine stamps that one.
     * The `user` row is the other half of a staff account and has to move with
     * it, or the member keeps appearing in every assignee picker in the admin.
     */
    await tx.user.updateMany({
      where: { id: { in: userIds } },
      data: revoke
        ? {
            deletedAt: new Date(),
            banned: true,
            banReason: 'Account deleted',
            banExpires: null,
          }
        : { deletedAt: null, banned: false, banReason: null, banExpires: null },
    });

    if (revoke) await tx.session.deleteMany({ where: { userId: { in: userIds } } });
  });
}

// --- Lookup --------------------------------------------------------------

export function descriptorFor(entity: TrashEntityKey): TrashDescriptor {
  return DESCRIPTORS[entity];
}

export function allDescriptors(): TrashDescriptor[] {
  return TRASH_ENTITIES.map((key) => DESCRIPTORS[key]);
}

/*
 * The delegate for an entity, and the `where` that selects a set of its rows.
 *
 * Two tables are keyed by their own code rather than a cuid, which is the whole
 * reason `idField` is declared per entry: an engine that assumed `id` would
 * silently match nothing on locations and carriers instead of failing.
 */
export function tableFor(entity: TrashEntityKey): Delegate {
  const table = delegates[DESCRIPTORS[entity].model];

  // A descriptor naming a model the client does not have is a typo in this file,
  // not a runtime condition — and the failure without this is `undefined.findMany`
  // deep inside a delete, which reads like a database problem.
  if (!table) {
    throw new Error(`No Prisma delegate named "${DESCRIPTORS[entity].model}"`);
  }

  return table;
}

export function whereIds(entity: TrashEntityKey, ids: string[]): object {
  return { [DESCRIPTORS[entity].idField]: { in: ids } };
}

// The row's own id, read back out of a `select` that included its key column.
export function idOf(entity: TrashEntityKey, row: Row): string {
  return String(row[DESCRIPTORS[entity].idField]);
}

// Every entity a `select` must carry its own key column for `idOf` to work.
export function selectFor(entity: TrashEntityKey): object {
  const descriptor = DESCRIPTORS[entity];
  return { [descriptor.idField]: true, ...descriptor.select };
}

// Ambient Prisma type re-export, so callers can build typed clauses against the
// same models this file names without importing Prisma twice.
export type { Prisma };
