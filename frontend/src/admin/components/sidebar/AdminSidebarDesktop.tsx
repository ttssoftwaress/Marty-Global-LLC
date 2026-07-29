import { LogOut } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import logoWhite from '@/assets/Marty-Logo-White.png';
import { AdminNavBadge } from './AdminNavBadge';
import { AdminSidebarUserBlock, type AdminSidebarUser } from './AdminSidebarUserBlock';
import {
  isAdminNavItemActive,
  type AdminNavBadges,
  type AdminNavItem,
} from './nav-items';

/*
 * Admin sidebar — desktop (lg and up). 280px wide, full-height navy column:
 * logo + nav list pinned to the top, user block + log out to the bottom.
 * The active item is a white pill with a navy label; the rest are 80%-opacity
 * white and lift to full opacity on hover.
 *
 * The nav list is long enough to crowd the user block on short viewports, so it
 * scrolls on its own while the brand mark and footer stay put.
 *
 * `items` arrives already filtered to what this member may open, so the three
 * variants cannot disagree about which sections exist.
 */

type AdminSidebarDesktopProps = {
  user: AdminSidebarUser;
  items: AdminNavItem[];
  badges?: AdminNavBadges;
  onLogout?: () => void;
  className?: string;
};

export function AdminSidebarDesktop({
  user,
  items,
  badges,
  onLogout,
  className,
}: AdminSidebarDesktopProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className={`flex h-full w-sidebar shrink-0 flex-col justify-between bg-primary px-6 pb-6 pt-8 ${className ?? ''}`}
    >
      <div className="flex min-h-0 w-full flex-col gap-6">
        <Link to="/admin" aria-label="Marty Global LLC — Admin dashboard" className="shrink-0">
          <img
            src={logoWhite}
            alt="Marty Global LLC"
            className="h-[3.1875rem] w-[9.125rem] object-contain"
          />
        </Link>

        <nav aria-label="Admin" className="min-h-0 w-full overflow-y-auto">
          <ul className="flex w-full flex-col gap-1">
            {items.map((item) => {
              const active = isAdminNavItemActive(item.to, pathname);
              const Icon = item.icon;

              return (
                <li key={item.to} className="w-full">
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin'}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'flex w-full items-center gap-3 rounded-input bg-white px-4 py-3 text-body font-semibold text-primary [&>svg]:text-accent'
                        : 'flex w-full items-center gap-3 rounded-input px-4 py-3 text-body font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white'
                    }
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words">{item.label}</span>
                    {item.badge ? (
                      <AdminNavBadge count={badges?.[item.badge] ?? 0} />
                    ) : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-4 pt-6">
        <AdminSidebarUserBlock user={user} />

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 text-body font-medium text-white/80 transition-colors hover:text-white"
        >
          <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="whitespace-nowrap">Log out</span>
        </button>
      </div>
    </aside>
  );
}
