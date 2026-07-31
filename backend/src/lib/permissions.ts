import { Role } from './roles.js';

/*
 * The staff role catalogue and the permission-area set, both server-owned.
 *
 * The frontend's team types document why: "adding an admin section is a backend
 * change, not a frontend deploy" — the edit screen renders whatever areas and
 * roles this file publishes, so neither list may live in the browser.
 *
 * Two role concepts sit side by side and must not be confused:
 *   - `Role` (lib/roles.ts) is the *authorization* role Better Auth stores on the
 *     user row. It is the only thing the guards read, and it has three values.
 *   - `StaffRole` below is the *job* role the org uses, stored on StaffProfile.
 *     It decides default access and what the UI labels a member, never whether a
 *     request is allowed.
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
   * shape as `orders.assign` and `support.assign`. Default on for super-admin
   * and operations-manager only; every other role is granted it per member.
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
   *
   * Never a default on any role. It reads across every section — including team
   * changes and payment reconciliation — so it is granted deliberately, per
   * member, from the team screen.
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
 * themselves, which is why this needed no migration and why `hasPermission`
 * answers both kinds of question without knowing the difference.
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

/*
 * A job role. `authRole` is the Better Auth role a member of this job role
 * carries — which is what actually gates every request — so promoting someone to
 * super-admin here is what makes the guards treat them as an admin.
 *
 * `defaults` seeds the permission grid when a member is created or their role
 * changes; an admin can then narrow it per member. `locked` areas may not be
 * toggled on this role at all: a super-admin cannot be denied team management,
 * because doing so would strand the account that grants it back.
 */
export type StaffRoleDefinition = {
  key: string;
  label: string;
  authRole: Role;
  defaults: readonly PermissionKey[];
  locked: readonly PermissionKey[];
};

const AREA_KEYS = PERMISSION_AREAS.map((area) => area.key) as PermissionAreaKey[];

const ALL_SCOPES = SCOPED_AREAS.map(scopeKeyFor);

// Every key there is — areas and their scope companions. What a super-admin holds.
const ALL_KEYS: PermissionKey[] = [...AREA_KEYS, ...ALL_SCOPES];

export const STAFF_ROLES: readonly StaffRoleDefinition[] = [
  {
    key: 'super-admin',
    label: 'Super Admin',
    authRole: Role.ADMIN,
    defaults: ALL_KEYS,
    // A super-admin always keeps team management; see above.
    locked: ['team'],
  },
  {
    key: 'operations-manager',
    label: 'Operations Manager',
    authRole: Role.ADMIN,
    defaults: [
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
  },
  {
    /*
     * The three staff roles below take areas but no `.all` companions. That is
     * the point of the split: a reviewer opens the orders queue and sees the
     * filings assigned to them, not the org's. An admin widens any one section
     * per member from the team screen.
     */
    key: 'reviewer',
    label: 'Reviewer / Compliance',
    authRole: Role.STAFF,
    // Works the orders they hold; reassigning is granted per member, not by default.
    // Requests included: a reviewer delivered the record, so the follow-ups
    // raised against it are theirs to work.
    defaults: ['orders', 'requests', 'customers', 'reports'],
    locked: [],
  },
  {
    key: 'support-agent',
    label: 'Support Agent',
    authRole: Role.STAFF,
    // After-sales requests are this role's core work, which is the reason the
    // area is separate from `orders` at all.
    defaults: ['support', 'requests', 'customers', 'orders', 'leads'],
    locked: [],
  },
  {
    key: 'mail-operator',
    label: 'Mail Room Operator',
    authRole: Role.STAFF,
    defaults: ['mailroom', 'customers'],
    locked: [],
  },
];

const ROLE_BY_KEY = new Map(STAFF_ROLES.map((role) => [role.key, role]));

export function findStaffRole(key: string): StaffRoleDefinition | undefined {
  return ROLE_BY_KEY.get(key);
}

// An unknown key still renders a row rather than dropping the member — the
// catalogue can shrink while rows referencing an old key survive.
export function staffRoleLabel(key: string): string {
  return ROLE_BY_KEY.get(key)?.label ?? key;
}

export const DEFAULT_STAFF_ROLE = 'support-agent';

/*
 * The permission grid as the edit screen renders it: every area, marked granted
 * or not, with the ones this role may not change flagged `locked`.
 *
 * Sending every key (rather than only the granted ones) is deliberate — the
 * frontend documents that a missing key reads as not granted, so both shapes
 * work, and sending all of them means a denied area is visibly denied rather
 * than silently absent.
 */
export function permissionMap(granted: readonly string[]): Record<string, boolean> {
  const set = new Set(granted);
  return Object.fromEntries(
    [...AREA_KEYS, ...ALL_SCOPES].map((key) => [key, set.has(key)]),
  );
}

/*
 * The grid the edit screen renders: one row per area, each carrying up to two
 * switches.
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
 */
export function permissionAreasFor(roleKey: string) {
  const locked = new Set(findStaffRole(roleKey)?.locked ?? []);

  return PERMISSION_AREAS.map((area) => ({
    key: area.key,
    label: area.label,
    ...(isScopedArea(area.key) ? { scopeKey: scopeKeyFor(area.key) } : {}),
    ...(locked.has(area.key) ? { locked: true } : {}),
  }));
}

/*
 * Resolve what to actually store from a submitted permission map. Keys the
 * catalogue doesn't know are dropped, and a role's locked areas are forced on —
 * the client's map is a request, never the final word (AGENTS.md: business logic
 * lives in services).
 */
export function resolvePermissions(
  roleKey: string,
  submitted: Record<string, boolean>,
): PermissionKey[] {
  const locked = findStaffRole(roleKey)?.locked ?? [];
  const granted = new Set<PermissionKey>(locked);

  for (const [key, on] of Object.entries(submitted)) {
    if (on && isPermissionKey(key)) granted.add(key);
  }

  /*
   * "All data" without the area itself is not a state a member can be in: the
   * scope widens a section they cannot open, so it would sit in the grid reading
   * as access they do not have. Turning the area off drops its companion here
   * rather than in the UI, so a hand-written payload cannot store the pair the
   * form would never submit.
   */
  for (const area of SCOPED_AREAS) {
    if (!granted.has(area)) granted.delete(scopeKeyFor(area));
  }

  // Stored in catalogue order so two equal sets compare equal in a diff/audit.
  return ALL_KEYS.filter((key) => granted.has(key));
}

export const roleOptions = () =>
  STAFF_ROLES.map((role) => ({ value: role.key, label: role.label }));
