import { Role } from './roles.js';

/*
 * The permission-area catalogue and the pure algebra over it. No Prisma here —
 * `lib/staff-permissions.ts` is the layer that reads roles out of the database.
 *
 * WHAT IS CODE AND WHAT IS DATA
 *
 * The *areas* below stay code: each one maps onto a guarded admin sub-router, so
 * adding an area is a backend change by definition — there is nothing for a new
 * key to unlock until a router asks for it. The frontend's team types document
 * the same rule from the other side: "adding an admin section is a backend
 * change, not a frontend deploy".
 *
 * Which areas a *role* grants is data. An admin defines roles on the Team &
 * staff screen (`StaffRole`), and `SYSTEM_STAFF_ROLES` at the bottom of this file
 * is only what an empty install is provisioned with — after boot the database row
 * is the truth, and editing a role there moves everyone holding it.
 *
 * Two role concepts sit side by side and must not be confused:
 *   - `Role` (lib/roles.ts) is the *authorization* role Better Auth stores on the
 *     user row. It is the only thing the guards read, and it has three values.
 *   - A `StaffRole` is the *job* role the org uses, stored on StaffProfile. It
 *     decides which admin sections open and what the UI labels a member; the
 *     `authRole` it carries is what actually gets written to the user row.
 */

export const PERMISSION_AREAS = [
  { key: 'orders', label: 'Orders & applications' },
  /*
   * Handing an order to someone else, as distinct from working the one you hold.
   * A reviewer advances a status and answers their customer; deciding who on the
   * team owns a filing is a rota decision, so it is granted separately and an
   * admin hands it out per member.
   *
   * A member without this area keeps every other order control — the assignee
   * select is the only thing that closes to them.
   */
  { key: 'orders.assign', label: 'Assign orders to staff' },
  { key: 'customers', label: 'Customer records' },
  /*
   * Follow-up requests customers raise against a delivered service — the
   * `/admin/requests` queue.
   *
   * Its own area rather than part of `orders`, because it is a different job:
   * an order is worked once, priced, and filed, while a request is a small piece
   * of after-sales work against something already delivered. A support agent who
   * should never touch the filing pipeline is exactly who works these.
   */
  { key: 'requests', label: 'Service requests' },
  { key: 'catalog', label: 'Service catalog & pricing' },
  { key: 'payments', label: 'Quotes & payments' },
  /*
   * Confirming that money we cannot see arrived — marking a wire transfer paid.
   *
   * Its own area rather than part of `payments`, and the most consequential
   * grant in this list: a USDT payment is credited by the chain, but a wire has
   * no poller behind it, so this switch is the only thing standing between a
   * staff member and settling an invoice nobody paid. Working the ledger and
   * deciding money landed are different jobs.
   *
   * A write grant, not a section, so it carries no `.all` companion — the same
   * shape as `orders.assign` and `support.assign`.
   */
  { key: 'payments.settle', label: 'Confirm wire payments received' },
  { key: 'mailroom', label: 'Virtual mail operations' },
  { key: 'support', label: 'Support inbox' },
  /*
   * Moving a chat from one agent to another, as distinct from working the chats
   * you hold. The exact mirror of `orders.assign` above, and separate for the
   * same reason: incoming chats are routed automatically and balanced across the
   * team (modules/support/support.assignment.ts), so overriding that routing is a
   * supervisor's decision rather than part of answering customers.
   *
   * A member without this area still works every chat they are given — reply,
   * note, status — the assignee control is the only thing that closes to them.
   */
  { key: 'support.assign', label: 'Assign chats to staff' },
  { key: 'reports', label: 'Reports & analytics' },
  /*
   * The marketing contact form's submissions (`/admin/leads`). Org-wide with no
   * owner to scope it to — a lead isn't assigned to anyone until someone acts on
   * it — so it carries no `.all` companion, the same shape as `catalog`.
   */
  { key: 'leads', label: 'Contact form leads' },
  { key: 'team', label: 'Team & staff management' },
  /*
   * Business settings — the reference data every other section picks FROM: the
   * locations services are offered in and the carriers the mail room ships with.
   *
   * Its own area rather than part of `catalog`, because it sits upstream of the
   * catalog rather than inside it. The orders queue filters by location, a
   * customer's row prints one, and the mail room's forwarding form picks a
   * carrier — none of which involve a service's price or its form. Granting
   * someone the catalog should not also let them retire a jurisdiction every one
   * of those screens reads.
   */
  { key: 'settings', label: 'Business settings' },
  /*
   * The audit log — the read-only trail of who did what, across every other
   * area. Its own grantable area rather than admin-only, because reviewing the
   * trail is a compliance job that does not need the power to change anything:
   * a member holding this can see that a role was changed without being able to
   * change one, which is the whole point of separating the reviewer from the
   * actor.
   */
  { key: 'audit', label: 'Audit log' },
] as const;

export type PermissionAreaKey = (typeof PERMISSION_AREAS)[number]['key'];

/*
 * --- Data scope ----------------------------------------------------------
 *
 * Holding an area answers "may this member open this section". It does not
 * answer "whose records does it show them", and those are different questions:
 * a reviewer works the filings assigned to them, while an operations manager
 * oversees the whole pipeline. Both hold `orders`.
 *
 * So every scopeable area carries a second, companion grant — `<area>.all` —
 * which is what widens that section from the member's own records to the whole
 * org. The team screen renders the pair as two columns: "Specific data" is the
 * area key, "All data" is this key. Denied it, a member sees only what is
 * theirs; granted it, they see everything in that section.
 *
 * The companion keys live in the same `permissions` string array as the areas
 * themselves, which is why `hasPermission` answers both kinds of question
 * without knowing the difference.
 *
 * `orders.assign`, `support.assign`, and `payments.settle` are deliberately NOT
 * derived from this: they grant a *write* (choosing who owns a filing or a chat,
 * or declaring that money arrived), not a view, so each stays its own area with
 * its own row. The two assign grants do still widen their queue — distributing
 * work you cannot see is impossible — which `canSeeAll` folds in.
 */
const SCOPE_SUFFIX = '.all';

/*
 * Areas whose data belongs to somebody. `catalog`, `team`, and `settings` are
 * absent on purpose — a service's price, the staff directory, and the location
 * list are org-wide records with no owner to scope them to, so an "All data"
 * switch there would be a control that changes nothing. `orders.assign`,
 * `support.assign`, and `payments.settle` are absent because they are write
 * grants, not sections.
 */
export const SCOPED_AREAS = [
  'orders',
  'customers',
  'requests',
  'payments',
  'mailroom',
  'support',
  'reports',
] as const;

export type ScopedArea = (typeof SCOPED_AREAS)[number];

export type ScopeKey = `${ScopedArea}${typeof SCOPE_SUFFIX}`;

export function scopeKeyFor(area: ScopedArea): ScopeKey {
  return `${area}${SCOPE_SUFFIX}`;
}

const SCOPED_AREA_SET: ReadonlySet<string> = new Set(SCOPED_AREAS);

export function isScopedArea(value: unknown): value is ScopedArea {
  return typeof value === 'string' && SCOPED_AREA_SET.has(value);
}

// Every key that may appear in a stored grant list: the areas, plus one scope
// companion per scopeable area.
export type PermissionKey = PermissionAreaKey | ScopeKey;

const PERMISSION_KEYS: ReadonlySet<string> = new Set<string>([
  ...PERMISSION_AREAS.map((area) => area.key),
  ...SCOPED_AREAS.map(scopeKeyFor),
]);

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && PERMISSION_KEYS.has(value);
}

const AREA_KEYS = PERMISSION_AREAS.map((area) => area.key) as PermissionAreaKey[];

const ALL_SCOPES = SCOPED_AREAS.map(scopeKeyFor);

// Every key there is — areas and their scope companions, in catalogue order.
export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = [
  ...AREA_KEYS,
  ...ALL_SCOPES,
];

/*
 * --- The algebra ---------------------------------------------------------
 *
 * Three functions, and every permission write in the system goes through them.
 * They are pure so the rules can be tested without a database, and so the guard,
 * the team screen, and the role screen cannot each grow their own version.
 */

/*
 * Reduce an arbitrary key list to a legal stored grant set.
 *
 * Three rules, in order: drop keys the catalogue does not know, force `forced` on
 * (a role's locked areas), and drop any `<area>.all` whose area is not granted.
 *
 * That last one is the invariant the whole storage layer owes the guards.
 * `canSeeAll` reads the stored list directly, so a stranded scope key would be an
 * org-wide read grant nobody granted. The form would never submit one — this is
 * where a hand-written payload stops being able to.
 *
 * Returned in catalogue order so two equal sets compare equal in a diff or an
 * audit entry.
 */
export function sanitizePermissionKeys(
  keys: Iterable<string>,
  forced: Iterable<string> = [],
): PermissionKey[] {
  const granted = new Set<PermissionKey>();

  for (const key of keys) if (isPermissionKey(key)) granted.add(key);
  for (const key of forced) if (isPermissionKey(key)) granted.add(key);

  for (const area of SCOPED_AREAS) {
    if (!granted.has(area)) granted.delete(scopeKeyFor(area));
  }

  return ALL_PERMISSION_KEYS.filter((key) => granted.has(key));
}

/*
 * What a member actually holds: their role's grants, with their own overrides
 * applied on top.
 *
 * This is the one definition of "effective". An override entry set to `false`
 * takes a key away that the role gives — which is the point of the whole
 * mechanism: an admin can deny one member something their colleagues on the same
 * role keep. An entry set to `true` adds one the role does not give.
 *
 * Locked keys survive both: a role's locked area is forced back on after the
 * overrides are applied, so no payload can deny it.
 */
export function effectivePermissions(params: {
  rolePermissions: readonly string[];
  overrides: PermissionOverrides;
  locked?: readonly string[];
}): PermissionKey[] {
  const granted = new Set<string>(params.rolePermissions);

  for (const [key, on] of Object.entries(params.overrides)) {
    if (!isPermissionKey(key)) continue;
    if (on) granted.add(key);
    else granted.delete(key);
  }

  return sanitizePermissionKeys(granted, params.locked ?? []);
}

/*
 * The inverse: given the grid an admin just left the switches in, work out what
 * to store as this member's overrides.
 *
 * Only deviations are stored. A key the admin left agreeing with the role is
 * absent from the map entirely, which is what lets a later role edit move that
 * member — the override map is a list of decisions taken *about this account*,
 * not a snapshot of the grid.
 *
 * `submitted` is sanitized first, so the pair this produces always round-trips:
 * `effectivePermissions(role, overridesFor(role, submitted))` equals the
 * sanitized `submitted`.
 */
export function overridesFor(params: {
  rolePermissions: readonly string[];
  submitted: Record<string, boolean>;
  locked?: readonly string[];
}): PermissionOverrides {
  const locked = params.locked ?? [];

  const wanted = new Set(
    sanitizePermissionKeys(
      Object.entries(params.submitted)
        .filter(([, on]) => on)
        .map(([key]) => key),
      locked,
    ),
  );

  const role = new Set(sanitizePermissionKeys(params.rolePermissions, locked));
  const overrides: PermissionOverrides = {};

  for (const key of ALL_PERMISSION_KEYS) {
    const held = wanted.has(key);
    if (held !== role.has(key)) overrides[key] = held;
  }

  return overrides;
}

/*
 * A member's stored deviations from their role. `true` adds a key the role does
 * not give, `false` removes one it does; an absent key follows the role.
 *
 * Stored as Json on StaffProfile rather than as two string arrays because the
 * absent/true/false distinction is the whole contract, and two arrays can
 * disagree with each other in a way one map cannot.
 */
export type PermissionOverrides = Partial<Record<PermissionKey, boolean>>;

// Prisma hands back `Prisma.JsonValue`; narrow it without trusting the column.
export function parseOverrides(value: unknown): PermissionOverrides {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  const parsed: PermissionOverrides = {};

  for (const [key, on] of Object.entries(value as Record<string, unknown>)) {
    if (isPermissionKey(key) && typeof on === 'boolean') parsed[key] = on;
  }

  return parsed;
}

/*
 * The permission grid as the edit screen renders it: every key, marked granted
 * or not.
 *
 * Sending every key (rather than only the granted ones) is deliberate — the
 * frontend documents that a missing key reads as not granted, so both shapes
 * work, and sending all of them means a denied area is visibly denied rather
 * than silently absent.
 */
export function permissionMap(granted: readonly string[]): Record<string, boolean> {
  const set = new Set(granted);
  return Object.fromEntries(ALL_PERMISSION_KEYS.map((key) => [key, set.has(key)]));
}

/*
 * The grid's rows: one per area, each carrying up to two switches.
 *
 * `key` is the "Specific data" switch — may this member open the section at all.
 * `scopeKey`, when present, is the "All data" switch beside it. An area without
 * a `scopeKey` (catalog, team, orders.assign) renders one switch and an empty
 * cell in the second column: there is no ownership to narrow it to, so offering
 * the toggle would imply a distinction that does not exist.
 *
 * Sending the pairing from here — rather than letting the browser append
 * ".all" — keeps the same promise the area list already makes: which sections
 * are scopeable is a backend decision, not a frontend one.
 *
 * `locked` comes from the role the grid is being rendered for, so the caller
 * passes it rather than a role key: the roles live in the database now, and this
 * file no longer knows how to look one up.
 */
export function permissionAreasFor(locked: readonly string[] = []) {
  const lockedSet = new Set(locked);

  return PERMISSION_AREAS.map((area) => ({
    key: area.key,
    label: area.label,
    ...(isScopedArea(area.key) ? { scopeKey: scopeKeyFor(area.key) } : {}),
    ...(lockedSet.has(area.key) ? { locked: true } : {}),
  }));
}

/*
 * --- System roles --------------------------------------------------------
 *
 * What an empty database is provisioned with (`lib/staff-roles.ts` writes them
 * on boot). After that the `StaffRole` rows are the source of truth: an admin may
 * relabel these and change what they grant, and the provisioner will not
 * overwrite the edit.
 *
 * They are undeletable and their `authRole` is fixed. `super-admin` in particular
 * is the role that hands access back out, so an install always keeps one.
 */
export type SystemStaffRole = {
  key: string;
  label: string;
  authRole: Role;
  permissions: readonly PermissionKey[];
  /*
   * Areas that may not be toggled off on this role — not on the role itself, and
   * not per member. A super-admin denied `team` strands the account that grants
   * it back, and the recovery is a database edit, which AGENTS.md forbids.
   */
  locked: readonly PermissionKey[];
  sortOrder: number;
};

export const SUPER_ADMIN_ROLE_KEY = 'super-admin';

export const SYSTEM_STAFF_ROLES: readonly SystemStaffRole[] = [
  {
    key: SUPER_ADMIN_ROLE_KEY,
    label: 'Super Admin',
    authRole: Role.ADMIN,
    permissions: ALL_PERMISSION_KEYS,
    locked: ['team'],
    sortOrder: 10,
  },
  {
    key: 'operations-manager',
    label: 'Operations Manager',
    authRole: Role.ADMIN,
    permissions: [
      'orders',
      // Distributing work across the team is what this role is for.
      'orders.assign',
      'customers',
      'requests',
      'catalog',
      'payments',
      // Reconciling what customers wired is this role's work, not an
      // administrator's — the money has to be confirmed the day it lands.
      'payments.settle',
      'mailroom',
      'support',
      // Overriding the chat router — the same rota decision as `orders.assign`.
      'support.assign',
      'reports',
      // Which jurisdictions we operate in and who we ship with are operational
      // decisions, which is exactly this role's remit.
      'settings',
      // Overseeing the pipeline includes overseeing who acted on it. The only
      // other role holding this by default is super-admin.
      'audit',
      // Overseeing the pipeline means seeing all of it — this role is the reason
      // the org-wide scope exists.
      ...ALL_SCOPES,
    ],
    locked: [],
    sortOrder: 20,
  },
  {
    /*
     * The three staff roles below take areas but no `.all` companions. That is
     * the point of the split: a reviewer opens the orders queue and sees the
     * filings assigned to them, not the org's. An admin widens any one section
     * per member from the team screen — which is an override, so widening it for
     * one reviewer leaves the others narrow.
     */
    key: 'reviewer',
    label: 'Reviewer / Compliance',
    authRole: Role.STAFF,
    // Works the orders they hold; reassigning is granted per member, not by
    // default. Requests included: a reviewer delivered the record, so the
    // follow-ups raised against it are theirs to work.
    permissions: ['orders', 'requests', 'customers', 'reports'],
    locked: [],
    sortOrder: 30,
  },
  {
    key: 'support-agent',
    label: 'Support Agent',
    authRole: Role.STAFF,
    // After-sales requests are this role's core work, which is the reason the
    // area is separate from `orders` at all.
    permissions: ['support', 'requests', 'customers', 'orders', 'leads'],
    locked: [],
    sortOrder: 40,
  },
  {
    key: 'mail-operator',
    label: 'Mail Room Operator',
    authRole: Role.STAFF,
    permissions: ['mailroom', 'customers'],
    locked: [],
    sortOrder: 50,
  },
];

const SYSTEM_ROLE_KEYS: ReadonlySet<string> = new Set(
  SYSTEM_STAFF_ROLES.map((role) => role.key),
);

export function isSystemRoleKey(key: string): boolean {
  return SYSTEM_ROLE_KEYS.has(key);
}

export const DEFAULT_STAFF_ROLE = 'support-agent';
