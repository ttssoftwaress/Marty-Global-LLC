import { describe, expect, it } from 'vitest';

import {
  permissionAreasFor,
  permissionMap,
  resolvePermissions,
  scopeKeyFor,
  SCOPED_AREAS,
} from './permissions.js';

/*
 * The permission catalogue is pure — no DB, no auth context — so these run as
 * plain unit tests. What they protect is the one invariant the storage layer
 * owes the guards: a `<area>.all` scope key may never persist without the area
 * it widens. `canSeeAll` reads the stored list directly, so a stranded scope key
 * is an access grant nobody granted.
 */

describe('resolvePermissions', () => {
  it('stores an area and its scope companion together', () => {
    expect(
      resolvePermissions('reviewer', { payments: true, 'payments.all': true }),
    ).toEqual(['payments', 'payments.all']);
  });

  it('drops an orphaned scope key when the area itself is off', () => {
    // The key invariant: scope without access must never persist. The form
    // would never submit this pair, but a hand-written payload can.
    expect(
      resolvePermissions('reviewer', { payments: false, 'payments.all': true }),
    ).toEqual([]);
  });

  it('drops every orphaned scope key, not just the first', () => {
    expect(
      resolvePermissions('reviewer', {
        orders: true,
        'orders.all': true,
        customers: false,
        'customers.all': true,
        payments: false,
        'payments.all': true,
      }),
    ).toEqual(['orders', 'orders.all']);
  });

  it('drops keys the catalogue does not know', () => {
    expect(
      resolvePermissions('reviewer', {
        orders: true,
        'not-an-area': true,
        'orders.everything': true,
      }),
    ).toEqual(['orders']);
  });

  it('forces a role’s locked areas on even when submitted off', () => {
    // A super-admin denied `team` strands the account that grants it back.
    expect(resolvePermissions('super-admin', { team: false })).toContain('team');
  });

  it('returns keys in catalogue order so two equal sets compare equal', () => {
    const submitted = { payments: true, orders: true, 'orders.all': true };

    expect(resolvePermissions('reviewer', submitted)).toEqual([
      'orders',
      'payments',
      'orders.all',
    ]);
  });
});

describe('permissionAreasFor', () => {
  const areas = permissionAreasFor('reviewer');
  const byKey = new Map(areas.map((area) => [area.key, area]));

  it('emits a scopeKey on every scopeable area', () => {
    for (const area of SCOPED_AREAS) {
      expect(byKey.get(area)).toMatchObject({ scopeKey: scopeKeyFor(area) });
    }

    // The list the task names, spelled out rather than derived, so shrinking
    // SCOPED_AREAS fails here instead of silently passing.
    expect(SCOPED_AREAS).toEqual([
      'orders',
      'customers',
      'requests',
      'payments',
      'mailroom',
      'support',
      'reports',
    ]);
  });

  it('emits no scopeKey on areas with no ownership to narrow to', () => {
    // A service's price and the staff directory are org-wide; `orders.assign`
    // is a write grant, not a section.
    for (const key of ['catalog', 'team', 'orders.assign'] as const) {
      expect(byKey.get(key)).toBeDefined();
      expect(byKey.get(key)).not.toHaveProperty('scopeKey');
    }
  });

  it('flags the locked areas of the role it is asked about', () => {
    const locked = permissionAreasFor('super-admin').find(
      (area) => area.key === 'team',
    );

    expect(locked).toMatchObject({ locked: true });
    expect(byKey.get('team')).not.toHaveProperty('locked');
  });
});

describe('permissionMap', () => {
  it('round-trips a stored scope key', () => {
    const map = permissionMap(['payments', 'payments.all']);

    expect(map['payments']).toBe(true);
    expect(map['payments.all']).toBe(true);
  });

  it('reports every catalogue key, denied ones included', () => {
    const map = permissionMap(['orders']);

    expect(map['orders']).toBe(true);
    expect(map['orders.all']).toBe(false);
    expect(map['team']).toBe(false);
    // Non-scopeable areas carry no companion key at all.
    expect(map).not.toHaveProperty('catalog.all');
  });
});
