import { describe, expect, it } from 'vitest';

import {
  effectivePermissions,
  overridesFor,
  parseOverrides,
  permissionAreasFor,
  permissionMap,
  sanitizePermissionKeys,
  scopeKeyFor,
  SCOPED_AREAS,
} from './permissions.js';

/*
 * The permission algebra is pure — no DB, no auth context — so these run as
 * plain unit tests.
 *
 * Two things are under test. The first is the invariant the storage layer owes
 * the guards: a `<area>.all` scope key may never persist without the area it
 * widens, because `canSeeAll` reads the stored list directly and a stranded
 * scope key is an org-wide read grant nobody granted.
 *
 * The second is the override contract, which is what makes the per-member
 * switches worth having: a key an admin decided for one account has to survive
 * their role being edited, and a key they left alone has to follow it.
 */

// A stand-in for a role an admin defined: grants the orders queue and the
// customer records, scoped to the member's own work.
const REVIEWER = { permissions: ['orders', 'customers', 'reports'], locked: [] };

describe('sanitizePermissionKeys', () => {
  it('keeps an area and its scope companion together', () => {
    expect(sanitizePermissionKeys(['payments', 'payments.all'])).toEqual([
      'payments',
      'payments.all',
    ]);
  });

  it('drops an orphaned scope key when the area itself is off', () => {
    // The key invariant: scope without access must never persist. The form
    // would never submit this pair, but a hand-written payload can.
    expect(sanitizePermissionKeys(['payments.all'])).toEqual([]);
  });

  it('drops every orphaned scope key, not just the first', () => {
    expect(
      sanitizePermissionKeys([
        'orders',
        'orders.all',
        'customers.all',
        'payments.all',
      ]),
    ).toEqual(['orders', 'orders.all']);
  });

  it('drops keys the catalogue does not know', () => {
    expect(
      sanitizePermissionKeys(['orders', 'not-an-area', 'orders.everything']),
    ).toEqual(['orders']);
  });

  it('forces the locked keys on even when absent', () => {
    // A super-admin denied `team` strands the account that grants it back.
    expect(sanitizePermissionKeys([], ['team'])).toEqual(['team']);
  });

  it('returns keys in catalogue order so two equal sets compare equal', () => {
    expect(sanitizePermissionKeys(['payments', 'orders.all', 'orders'])).toEqual([
      'orders',
      'payments',
      'orders.all',
    ]);
  });
});

describe('effectivePermissions', () => {
  it('gives the role’s own set when the member overrides nothing', () => {
    expect(
      effectivePermissions({
        rolePermissions: REVIEWER.permissions,
        overrides: {},
      }),
    ).toEqual(['orders', 'customers', 'reports']);
  });

  it('takes away a key the role grants — the whole point of an override', () => {
    expect(
      effectivePermissions({
        rolePermissions: REVIEWER.permissions,
        overrides: { customers: false },
      }),
    ).toEqual(['orders', 'reports']);
  });

  it('adds a key the role does not grant', () => {
    expect(
      effectivePermissions({
        rolePermissions: REVIEWER.permissions,
        overrides: { 'payments.settle': true },
      }),
    ).toContain('payments.settle');
  });

  it('drops a scope whose area an override took away', () => {
    // Denying the area has to take its widened view with it, or the member keeps
    // an org-wide read on a section they can no longer open.
    expect(
      effectivePermissions({
        rolePermissions: ['orders', 'orders.all'],
        overrides: { orders: false },
      }),
    ).toEqual([]);
  });

  it('refuses to let an override deny a locked key', () => {
    expect(
      effectivePermissions({
        rolePermissions: ['team'],
        overrides: { team: false },
        locked: ['team'],
      }),
    ).toEqual(['team']);
  });

  it('ignores an override on a key the catalogue does not know', () => {
    expect(
      effectivePermissions({
        rolePermissions: ['orders'],
        overrides: { 'not-an-area': true } as Record<string, boolean>,
      }),
    ).toEqual(['orders']);
  });
});

describe('overridesFor', () => {
  it('records nothing when the grid matches the role', () => {
    expect(
      overridesFor({
        rolePermissions: REVIEWER.permissions,
        submitted: permissionMap(REVIEWER.permissions),
      }),
    ).toEqual({});
  });

  /*
   * The behaviour the whole feature exists for: an admin switches one area off
   * for one member. Only that key is stored, and it is stored as a denial rather
   * than as a rewritten copy of the grid — which is what keeps every other key
   * following the role, and what keeps the denial pinned to this one account.
   */
  it('records a single denial when the admin switches one area off', () => {
    const submitted = permissionMap(REVIEWER.permissions);
    submitted['customers'] = false;

    expect(overridesFor({ rolePermissions: REVIEWER.permissions, submitted })).toEqual(
      { customers: false },
    );
  });

  it('records a single grant when the admin switches an extra area on', () => {
    const submitted = permissionMap(REVIEWER.permissions);
    submitted['payments.settle'] = true;

    expect(overridesFor({ rolePermissions: REVIEWER.permissions, submitted })).toEqual(
      { 'payments.settle': true },
    );
  });

  it('records nothing for a locked key, which no grid can change', () => {
    const submitted = permissionMap(['team']);
    submitted['team'] = false;

    expect(
      overridesFor({ rolePermissions: ['team'], submitted, locked: ['team'] }),
    ).toEqual({});
  });

  it('round-trips: applying what it records reproduces the submitted grid', () => {
    const submitted = permissionMap(['orders', 'orders.all', 'payments', 'audit']);

    const overrides = overridesFor({
      rolePermissions: REVIEWER.permissions,
      submitted,
    });

    expect(
      effectivePermissions({ rolePermissions: REVIEWER.permissions, overrides }),
    ).toEqual(sanitizePermissionKeys(['orders', 'orders.all', 'payments', 'audit']));
  });

  /*
   * A role edit reaches the keys nobody decided for this member, and stops at
   * the ones somebody did. Both halves matter: without the first, roles would be
   * a one-time template; without the second, editing a role would quietly undo
   * every individual decision an admin had made.
   */
  it('leaves untouched keys free to follow a later role edit', () => {
    const submitted = permissionMap(REVIEWER.permissions);
    submitted['customers'] = false;

    const overrides = overridesFor({
      rolePermissions: REVIEWER.permissions,
      submitted,
    });

    // The role later gains `payments` and `catalog`.
    const widened = [...REVIEWER.permissions, 'payments', 'catalog'];

    expect(effectivePermissions({ rolePermissions: widened, overrides })).toEqual([
      'orders',
      'catalog',
      'payments',
      'reports',
    ]);
  });

  /*
   * The denial is pinned to the account, not to the moment. A role that keeps
   * granting `customers` through any number of later edits still does not hand
   * it back to the member an admin took it from — only clearing the override
   * (`resetPermissions`, or a role change) does that.
   */
  it('keeps a denial in force across later edits to the same role', () => {
    const submitted = permissionMap(REVIEWER.permissions);
    submitted['customers'] = false;

    const overrides = overridesFor({
      rolePermissions: REVIEWER.permissions,
      submitted,
    });

    for (const rolePermissions of [
      REVIEWER.permissions,
      [...REVIEWER.permissions, 'customers.all'],
      [...REVIEWER.permissions, 'mailroom', 'leads'],
    ]) {
      expect(effectivePermissions({ rolePermissions, overrides })).not.toContain(
        'customers',
      );
    }
  });

  /*
   * A key nobody has decided for this member is not an override, so the role
   * gaining it hands it over. This is the half that makes a role edit worth
   * doing at all.
   */
  it('lets the role hand over a key no override speaks to', () => {
    const overrides = overridesFor({
      rolePermissions: REVIEWER.permissions,
      submitted: permissionMap(REVIEWER.permissions),
    });

    expect(
      effectivePermissions({
        rolePermissions: [...REVIEWER.permissions, 'payments'],
        overrides,
      }),
    ).toContain('payments');
  });
});

describe('parseOverrides', () => {
  it('drops keys and values the column should not hold', () => {
    expect(
      parseOverrides({ orders: true, 'not-an-area': true, customers: 'yes' }),
    ).toEqual({ orders: true });
  });

  it('reads a missing or malformed column as no overrides', () => {
    expect(parseOverrides(null)).toEqual({});
    expect(parseOverrides(['orders'])).toEqual({});
  });
});

describe('permissionAreasFor', () => {
  const areas = permissionAreasFor();
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
    // and `customers.ban` are write grants, not sections.
    for (const key of ['catalog', 'team', 'orders.assign', 'customers.ban'] as const) {
      expect(byKey.get(key)).toBeDefined();
      expect(byKey.get(key)).not.toHaveProperty('scopeKey');
    }
  });

  it('flags the locked areas it is given', () => {
    const locked = permissionAreasFor(['team']).find((area) => area.key === 'team');

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
