import {
  Bell,
  CreditCard,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquare,
  PlusCircle,
  Settings,
  ShoppingBag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
 * Portal sidebar navigation — the single source of truth for the nav list,
 * shared by all three sidebar variants (desktop, tablet rail, mobile drawer)
 * so the items and their order never drift between breakpoints.
 *
 * Routes are the portal's `/app/*` group. Labels come from the desktop Figma
 * link, which is the source of truth for copy across all three viewports.
 *
 * Note what is deliberately absent: order conversations. A conversation about an
 * order lives on that order's detail page, with the specialist assigned to it —
 * it is not a destination of its own. `Support` here is general help, routed to
 * whichever agent is free. Giving the two the same nav entry would suggest one
 * inbox, when the customer is really talking to two different sets of people.
 *
 * There is no separate footer "Support" link any more: it pointed at the same
 * `/app/support` this nav item now owns, and one destination does not get two
 * entries in the same sidebar.
 */

/*
 * `badge` names which counter this item's bubble reads, when it has one. The key
 * rather than the number, because the nav list is a static module and the counts
 * are live — the sidebar resolves the key against what the shell passes it, so
 * adding a counted item never means threading another prop through three
 * variants.
 */
export type PortalNavBadge = 'notifications' | 'support';

export type PortalNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: PortalNavBadge;
};

export type PortalNavBadges = Partial<Record<PortalNavBadge, number>>;

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
  { label: 'My orders', to: '/app/orders', icon: ShoppingBag },
  { label: 'Order new service', to: '/app/order', icon: PlusCircle },
  { label: 'Documents', to: '/app/documents', icon: FileText },
  { label: 'Virtual mail rooms', to: '/app/mailroom', icon: Mail },
  /*
   * The notifications feed had no nav entry at all — it was reachable only from
   * the bell panel's footer, which meant a customer who dismissed the panel had
   * no route back to their own history except a URL they'd have to know.
   */
  { label: 'Notifications', to: '/app/notifications', icon: Bell, badge: 'notifications' },
  { label: 'Support', to: '/app/support', icon: MessageSquare, badge: 'support' },
  { label: 'Billing & payments', to: '/app/billing', icon: CreditCard },
  { label: 'Account settings', to: '/app/settings', icon: Settings },
];

// The dashboard is the portal index, so it would match every nested `/app/*`
// route with a prefix test — it alone matches exactly.
export function isNavItemActive(to: string, pathname: string) {
  if (to === '/app') return pathname === '/app' || pathname === '/app/';
  return pathname === to || pathname.startsWith(`${to}/`);
}
