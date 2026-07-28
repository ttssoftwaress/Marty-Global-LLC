import { LogOut } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { AdminNavBadge } from './AdminNavBadge';
import { AdminSidebarAvatar, type AdminSidebarUser } from './AdminSidebarUserBlock';
import {
  isAdminNavItemActive,
  type AdminNavBadges,
  type AdminNavItem,
} from './nav-items';

/*
 * Admin sidebar — tablet (md up to lg). A 72px icon rail: the wordmark collapses
 * to an "M" tile, labels drop away, and the user block shrinks to its avatar.
 * Nav icons sit in 40px rounded squares; the active one is a white tile with a
 * navy glyph.
 *
 * Labels are invisible here, so every control carries its nav label as both an
 * accessible name and a native tooltip — otherwise the rail is unusable with a
 * screen reader and ambiguous with a mouse. A full nav list overflows a short
 * viewport, so the icon column scrolls while the logo mark and footer stay put.
 *
 * `items` arrives already filtered to what this member may open, so the three
 * variants cannot disagree about which sections exist.
 */

type AdminSidebarTabletProps = {
  user: AdminSidebarUser;
  items: AdminNavItem[];
  badges?: AdminNavBadges;
  onLogout?: () => void;
  className?: string;
};

export function AdminSidebarTablet({
  user,
  items,
  badges,
  onLogout,
  className,
}: AdminSidebarTabletProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className={`flex h-full w-[4.5rem] shrink-0 flex-col items-center justify-between bg-primary px-3 pb-6 pt-8 ${className ?? ''}`}
    >
      <div className="flex min-h-0 w-full flex-col items-center gap-8">
        <Link
          to="/admin"
          aria-label="Marty Global LLC — Admin dashboard"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-h5 font-bold text-primary"
        >
          M
        </Link>

        <nav aria-label="Admin" className="min-h-0 w-full overflow-y-auto">
          <ul className="flex w-full flex-col items-center gap-3">
            {items.map((item) => {
              const active = isAdminNavItemActive(item.to, pathname);
              const Icon = item.icon;
              const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;

              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin'}
                    title={item.label}
                    /* The rail has no visible labels, so the count has to be in
                     * the accessible name — the badge itself is decorative. */
                    aria-label={count > 0 ? `${item.label} — ${count} unread` : item.label}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'relative flex size-10 items-center justify-center rounded-input bg-white text-accent'
                        : 'relative flex size-10 items-center justify-center rounded-input text-white/80 transition-colors hover:bg-white/10 hover:text-white'
                    }
                  >
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                    {count > 0 ? (
                      <AdminNavBadge
                        count={count}
                        decorative
                        className="pointer-events-none absolute -right-0.5 -top-0.5"
                      />
                    ) : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="flex w-full shrink-0 flex-col items-center gap-5 pt-5">
        <AdminSidebarAvatar user={user} />

        <button
          type="button"
          onClick={onLogout}
          title="Log out"
          aria-label="Log out"
          className="flex size-8 items-center justify-center rounded-pill text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
