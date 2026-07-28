import { describe, expect, it } from 'vitest';

import { listAuditQuerySchema } from './audit.validation.js';

/*
 * The audit list's wire contract.
 *
 * Two of these refusals matter more than they look. A half-filled entity filter
 * and a backwards date window both return an empty page rather than an error if
 * they are allowed through — and on this screen an empty page reads as "nothing
 * happened", which is the one wrong answer an audit log must never give.
 */

describe('listAuditQuerySchema', () => {
  it('defaults to the unfiltered first page', () => {
    const parsed = listAuditQuerySchema.parse({});

    expect(parsed.category).toBe('all');
    expect(parsed.limit).toBe(25);
    expect(parsed.action).toBeUndefined();
    expect(parsed.cursor).toBeUndefined();
  });

  it('coerces the limit and holds it inside its bounds', () => {
    expect(listAuditQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(listAuditQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listAuditQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('requires an entity type and id together', () => {
    // An id with no type is ambiguous across tables — two models can hold the
    // same cuid — and ignoring the lone value would silently widen the query to
    // every model.
    expect(listAuditQuerySchema.safeParse({ entityId: 'abc' }).success).toBe(false);
    expect(listAuditQuerySchema.safeParse({ entityType: 'Order' }).success).toBe(false);

    expect(
      listAuditQuerySchema.safeParse({ entityType: 'Order', entityId: 'abc' }).success,
    ).toBe(true);
  });

  it('refuses a backwards window', () => {
    const backwards = listAuditQuerySchema.safeParse({
      from: '2026-07-29T00:00:00.000Z',
      to: '2026-07-01T00:00:00.000Z',
    });

    expect(backwards.success).toBe(false);

    expect(
      listAuditQuerySchema.safeParse({
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-07-29T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('accepts either bound on its own', () => {
    // An open-ended window is a normal ask — "everything since Monday".
    expect(
      listAuditQuerySchema.safeParse({ from: '2026-07-01T00:00:00.000Z' }).success,
    ).toBe(true);
    expect(
      listAuditQuerySchema.safeParse({ to: '2026-07-29T00:00:00.000Z' }).success,
    ).toBe(true);
  });

  it('requires an offset on a timestamp', () => {
    // A zoneless string is a date without an instant, and building a window from
    // one silently shifts it by the server's offset (AGENTS.md, Dates).
    expect(listAuditQuerySchema.safeParse({ from: '2026-07-29' }).success).toBe(false);
    expect(
      listAuditQuerySchema.safeParse({ from: '2026-07-29T00:00:00' }).success,
    ).toBe(false);
  });

  it('takes a category or an action as free strings', () => {
    /*
     * Deliberately not a closed enum: the table holds historical rows whose
     * action may no longer be in the current catalogue, and a retired verb still
     * has to be filterable. The service matches them against the catalogue.
     */
    expect(
      listAuditQuerySchema.parse({ category: 'auth', action: 'auth.sign_in_failed' })
        .action,
    ).toBe('auth.sign_in_failed');

    expect(listAuditQuerySchema.parse({ category: 'retired_section' }).category).toBe(
      'retired_section',
    );
  });
});
