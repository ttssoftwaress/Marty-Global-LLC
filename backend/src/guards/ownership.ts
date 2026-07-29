import { AppError } from '../lib/app-error.js';
import { Role } from '../lib/roles.js';
import type { AuthContext } from './auth-context.js';

// Ownership is a *service-layer* check (AGENTS.md "Security & PII"): the record
// has to be loaded before we can know who owns it, so this can't be middleware.
// Services call these after fetching the row.

export function isStaff(actor: AuthContext): boolean {
  return actor.role === Role.STAFF || actor.role === Role.ADMIN;
}

/*
 * Ownership is ownership: only the account a record belongs to passes.
 *
 * A staff role is deliberately NOT a bypass here, and this used to be the other
 * way round. These helpers are called from the customer-scoped routers
 * (`/v1/orders`, `/v1/mailrooms`, `/v1/support`), which answer for exactly one
 * account. Treating any STAFF or ADMIN session as the owner meant a staff
 * account with no `orders` permission and no assignment could read a stranger's
 * order detail, attach a document as if the customer had, and mint a presigned
 * link to their identity paperwork — through endpoints whose whole design
 * assumes the caller is the customer, and with none of the admin module's
 * permission checks, assignee scoping, or access auditing.
 *
 * Staff reach a customer's records through `/v1/admin`, where those three things
 * exist. Where staff genuinely share a customer-facing surface — the order
 * conversation, the chat sockets — the service asks `isStaff` explicitly and the
 * callsite says why.
 *
 * Returns 404, not 403: telling a caller "forbidden" would confirm the id is
 * real. Staff get the honest 403 from `requireStaff`/`requirePermission` on the
 * admin routes, where the id is not a secret.
 */
export function assertOwner(actor: AuthContext, ownerId: string): void {
  if (actor.userId !== ownerId) {
    throw AppError.notFound();
  }
}

// Narrows a possibly-missing record and its owner in one step, so services
// don't repeat the null-check / ownership pair on every read.
export function assertFound<T>(
  record: T | null | undefined,
  actor: AuthContext,
  ownerIdOf: (record: T) => string,
): T {
  if (!record) {
    throw AppError.notFound();
  }
  assertOwner(actor, ownerIdOf(record));
  return record;
}
