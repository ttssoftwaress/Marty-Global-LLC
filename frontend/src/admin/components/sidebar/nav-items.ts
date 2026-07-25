import {
  BarChart2,
  BookOpen,
  CreditCard,
  Inbox,
  LayoutGrid,
  Mail,
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
 */

export type AdminNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutGrid },
  { label: 'Orders queue', to: '/admin/orders', icon: ShoppingBag },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Quotes & payments', to: '/admin/payments', icon: CreditCard },
  { label: 'Support inbox', to: '/admin/support', icon: Inbox },
  { label: 'Virtual mail ops', to: '/admin/mailroom', icon: Mail },
  { label: 'Team & staff', to: '/admin/team', icon: UserCheck },
  { label: 'Service catalog', to: '/admin/catalog', icon: BookOpen },
  { label: 'Reports & analytics', to: '/admin/reports', icon: BarChart2 },
  { label: 'Admin settings', to: '/admin/settings', icon: Settings },
];

// The dashboard is the admin index, so it would match every nested `/admin/*`
// route with a prefix test — it alone matches exactly.
export function isAdminNavItemActive(to: string, pathname: string) {
  if (to === '/admin') return pathname === '/admin' || pathname === '/admin/';
  return pathname === to || pathname.startsWith(`${to}/`);
}
