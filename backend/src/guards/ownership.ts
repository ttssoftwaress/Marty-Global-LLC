import { AppError } from '../lib/app-error.js';
import { Role } from '../lib/roles.js';
import type { AuthContext } from './auth-context.js';

// Ownership is a *service-layer* check (AGENTS.md "Security & PII"): the record
// has to be loaded before we can know who owns it, so this can't be middleware.
// Services call these after fetching the row.

export function isStaff(actor: AuthContext): boolean {
  return actor.role === Role.STAFF || actor.role === Role.ADMIN;
}

// Staff and admin act on behalf of the business and may reach any customer's
// record; a customer may only reach their own.
export function canAccess(actor: AuthContext, ownerId: string): boolean {
  return isStaff(actor) || actor.userId === ownerId;
}

// Returns 404, not 403, when a customer asks for someone else's record — telling
// them "forbidden" would confirm the id exists. Staff get the real 403 path
// through requireRole, where the id is not a secret.
export function assertOwner(actor: AuthContext, ownerId: string): void {
  if (!canAccess(actor, ownerId)) {
    throw AppError.notFound();
  }
}

// For records a customer may read but only staff may change.
export function assertCanMutate(actor: AuthContext, ownerId: string): void {
  assertOwner(actor, ownerId);
  if (!isStaff(actor) && actor.userId !== ownerId) {
    throw AppError.unauthorized();
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
