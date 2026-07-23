import {
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
 */

export type PortalNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { label: 'Dashboard', to: '/app', icon: LayoutDashboard },
  { label: 'My orders', to: '/app/orders', icon: ShoppingBag },
  { label: 'Order new service', to: '/app/order', icon: PlusCircle },
  { label: 'Documents', to: '/app/documents', icon: FileText },
  { label: 'Virtual mail rooms', to: '/app/mailroom', icon: Mail },
  { label: 'Messages', to: '/app/messages', icon: MessageSquare },
  { label: 'Billing & payments', to: '/app/billing', icon: CreditCard },
  { label: 'Account settings', to: '/app/settings', icon: Settings },
];

export const PORTAL_SUPPORT_LINK = { label: 'Support', to: '/app/support' };

// The dashboard is the portal index, so it would match every nested `/app/*`
// route with a prefix test — it alone matches exactly.
export function isNavItemActive(to: string, pathname: string) {
  if (to === '/app') return pathname === '/app' || pathname === '/app/';
  return pathname === to || pathname.startsWith(`${to}/`);
}
