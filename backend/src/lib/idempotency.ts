import { Prisma } from '@prisma/client';

import { AppError } from './app-error.js';

/*
 * Replay protection for a mutating endpoint whose side effects cannot be undone.
 *
 * AGENTS.md ("API Conventions") asks for retry-safety on mutating endpoints. The
 * customer's checkout gets it from `Payment.idempotencyKey`, and the writes that
 * are naturally idempotent — a status change compared against current state, a
 * conditional claim on a cooldown — get it from their own guard. What is left is
 * the shape this helper is for: a write that inserts a row AND queues a message
 * to a customer, where "do it twice" means two rows and two emails.
 *
 * The pattern, and why it is these three steps rather than a pre-flight check:
 *
 *   1. Look the key up first. A sequential retry — a flaky network, a
 *      double-tapped button, a client-side retry — finds the original row and
 *      returns it, having sent nothing a second time.
 *   2. Insert with the key stored on the row, inside the same statement that
 *      creates it. There is no window in which the row exists without its key.
 *   3. If that insert loses a race to a genuinely concurrent submit, the unique
 *      index rejects it. The loser re-reads and returns the winner's row: the
 *      database is the arbiter, exactly as it is in the payments module.
 *
 * `owns` is the reason a guessed key cannot be used to read someone else's
 * record. The key is the caller's, and a key that resolves to a row outside the
 * scope they are acting in is refused rather than returned — a 409 that discloses
 * only that the key is spent.
 *
 * `replayed` travels back so the caller can skip the side effects: the email, the
 * feed row, and the audit entry all belong to the write that actually happened,
 * not to the retry that found it.
 */
export type IdempotentWrite<T> = { record: T; replayed: boolean };

export async function withIdempotency<T>(options: {
  /** Read the row carrying this request's key, or null if there is none yet. */
  find: () => Promise<T | null>;
  /** Insert the row with the key stored on it. */
  create: () => Promise<T>;
  /** Whether a row found by key belongs to what this caller is acting on. */
  owns: (record: T) => boolean;
}): Promise<IdempotentWrite<T>> {
  const existing = await options.find();
  if (existing) return { record: claim(existing, options.owns), replayed: true };

  try {
    return { record: await options.create(), replayed: false };
  } catch (error) {
    if (!isIdempotencyKeyCollision(error)) throw error;

    /*
     * A concurrent request claimed the key between the read and the write. The
     * constraint fires only once the winner has committed, so its row is
     * readable here — and it is the one that stands.
     */
    const winner = await options.find();
    if (!winner) throw error;

    return { record: claim(winner, options.owns), replayed: true };
  }
}

function claim<T>(record: T, owns: (record: T) => boolean): T {
  if (!owns(record)) {
    throw AppError.conflict('This Idempotency-Key has already been used');
  }
  return record;
}

/*
 * A P2002 specifically on an `idempotencyKey` column, rather than on any other
 * unique field the same insert touches. The distinction matters where a create is
 * already retried on P2002 for a different reason — `quotes.service` retries a
 * colliding human reference — and re-rolling that value would never clear a
 * collision on the key.
 *
 * `meta.target` is the column list on some drivers and the index name on others;
 * both spell out the column, so the check is a substring rather than an equality.
 */
export function isIdempotencyKeyCollision(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;
  const named = Array.isArray(target) ? target.join(',') : String(target ?? '');

  return named.includes('idempotencyKey');
}
