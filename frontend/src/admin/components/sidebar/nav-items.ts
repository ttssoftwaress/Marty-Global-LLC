import {
  BarChart2,
  Bell,
  BookOpen,
  ClipboardList,
  CreditCard,
  Inbox,
  LayoutGrid,
  ListChecks,
  Mail,
  MessageSquareText,
  MessagesSquare,
  ScrollText,
  Settings,
  ShoppingBag,
  UserCheck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
 * Admin sidebar navigation — the single source of truth for the nav list,
 * shared by all three sidebar variants (desktop, tablet rail, mobile drawer)
 * so the items and their order never drift between breakpoints.
 *
 * Routes are the admin's `/admin/*` group. Labels come from the desktop Figma
 * link, which is the source of truth for copy across all three viewports.
 *
 * `permission` names the backend area that gates the section's endpoints
 * (backend/src/lib/permissions.ts, enforced by `requirePermission`). It is what
 * makes the nav dynamic: a member sees a section only when they hold its area,
 * so a mail operator no longer gets a "Team & staff" link that 403s on arrival.
 *
 * An item with no `permission` is one every staff member gets — the dashboard
 * they land on, their own notification inbox, and their own settings. Those
 * three routes are deliberately un-narrowed on the backend too, for the same
 * reason, so the nav and the API agree.
 *
 * The key strings are duplicated from the backend catalogue rather than fetched,
 * which is the one place this app names areas. That is the two-apps mirror rule
 * (AGENTS.md), not a fetch that was skipped: a *new* backend area still needs a
 * frontend deploy here to gain a label, icon, and route — the "backend change,
 * not a frontend deploy" rule the team screen follows applies to the permission
 * *grid*, which stays fully server-driven. An unknown area simply has no nav
 * item yet; it never hides a section it doesn't name.
 */

/*
 * `badge` names which counter this item's bubble reads, when it has one. The key
 * rather than the number, because the nav list is a static module and the counts
 * are live — the sidebar resolves the key against what the shell passes it.
 *
 * Only the member's own two counters, deliberately: a queue-depth badge ("12
 * orders waiting") would be a number every staff member sees the same, on a
 * screen whose scope differs per member, so it would contradict the list under
 * it for anyone without the area's `.all` grant.
 */
export type AdminNavBadgeKey = 'notifications' | 'support';

export type AdminNavBadges = Partial<Record<AdminNavBadgeKey, number>>;

export type AdminNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
  badge?: AdminNavBadgeKey;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutGrid },
  { label: 'Orders queue', to: '/admin/orders', icon: ShoppingBag, permission: 'orders' },
  { label: 'Customers', to: '/admin/customers', icon: Users, permission: 'customers' },
  { label: 'Quotes & payments', to: '/admin/payments', icon: CreditCard, permission: 'payments' },
  {
    label: 'Support inbox',
    to: '/admin/support',
    icon: Inbox,
    permission: 'support',
    badge: 'support',
  },
  /*
   * Distinct from the support inbox above, and the two must not be conflated: the
   * inbox is the shared helpdesk queue any agent may claim from, while this lists
   * the order conversations assigned to *this* member — threads only they can
   * answer, which no shared queue would ever surface to them.
   *
   * Gated on `orders`, not `support`, because answering a customer about their
   * filing is part of working the order (the backend route agrees).
   */
  {
    label: 'My conversations',
    to: '/admin/conversations',
    icon: MessagesSquare,
    permission: 'orders',
  },
  /*
   * Follow-ups customers raise against a delivered service. Its own area rather
   * than part of `orders`, because it is a different job: an order is worked
   * once and filed, while a request is small after-sales work against something
   * already delivered — exactly what a support agent handles without ever
   * touching the filing pipeline.
   */
  {
    label: 'Service requests',
    to: '/admin/requests',
    icon: ClipboardList,
    permission: 'requests',
  },
  {
    label: 'Notifications',
    to: '/admin/notifications',
    icon: Bell,
    badge: 'notifications',
  },
  { label: 'Virtual mail ops', to: '/admin/mailroom', icon: Mail, permission: 'mailroom' },
  { label: 'Team & staff', to: '/admin/team', icon: UserCheck, permission: 'team' },
  { label: 'Service catalog', to: '/admin/catalog', icon: BookOpen, permission: 'catalog' },
  /*
   * The field registry — the questions service forms are built from. Sits beside
   * the catalog and carries the same area, because it is the vocabulary the
   * catalog's form builder picks from: anyone who may shape a service's form
   * needs to read it.
   */
  { label: 'Form fields', to: '/admin/fields', icon: ListChecks, permission: 'catalog' },
  { label: 'Reports & analytics', to: '/admin/reports', icon: BarChart2, permission: 'reports' },
  /*
   * Submissions from the marketing site's contact form. Its own area rather
   * than `support`, because a lead isn't a conversation — there is no reply
   * thread, only the record and whether someone has followed up.
   */
  { label: 'Leads', to: '/admin/leads', icon: MessageSquareText, permission: 'leads' },
  /*
   * The reference data every other section picks from — the locations services
   * are offered in, and the carriers the mail room ships with.
   *
   * Its own area rather than `catalog`, because it sits upstream of the catalog:
   * the orders queue filters by location and the mail room picks a carrier,
   * neither of which involves a service's price or its form.
   */
  { label: 'Admin settings', to: '/admin/settings', icon: Settings, permission: 'settings' },
  /*
   * The audit log — the read-only trail of who did what, across every section
   * above it. Last in the list because it is read about the others rather than
   * used to do work of its own.
   *
   * Its own area rather than admin-only: reviewing the trail is a compliance job
   * that does not need the power to change anything, so a member can be given
   * sight of it without being given the actions it records. It is not a default
   * on any role except super-admin and operations manager, so for most members
   * this item simply is not there.
   */
  { label: 'Audit log', to: '/admin/audit', icon: ScrollText, permission: 'audit' },
];

/*
 * The nav list for one member: the shared items, plus each gated item they hold
 * the area for. Order is preserved from the list above, so two members with
 * different access still see the same sections in the same places.
 *
 * `permissions` is `undefined` while the record loads. Returning the ungated
 * items only — rather than everything or nothing — means the nav never briefly
 * shows a section the member cannot open, and never flickers from a full list
 * down to a short one. It fills in when the record arrives.
 */
export function visibleAdminNavItems(
  permissions: readonly string[] | undefined,
): AdminNavItem[] {
  if (!permissions) return ADMIN_NAV_ITEMS.filter((item) => !item.permission);

  const granted = new Set(permissions);
  return ADMIN_NAV_ITEMS.filter(
    (item) => !item.permission || granted.has(item.permission),
  );
}

// The dashboard is the admin index, so it would match every nested `/admin/*`
// route with a prefix test — it alone matches exactly.
export function isAdminNavItemActive(to: string, pathname: string) {
  if (to === '/admin') return pathname === '/admin' || pathname === '/admin/';
  return pathname === to || pathname.startsWith(`${to}/`);
}
