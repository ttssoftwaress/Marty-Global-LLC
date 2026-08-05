import { LogOut } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { AdminNavBadge } from './AdminNavBadge';
import {
  AdminSidebarAvatarButton,
  type AdminSidebarUser,
} from './AdminSidebarUserBlock';
import {
  ADMIN_NAV_BADGE_NOUN,
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
 * viewport, so the icon column scrolls while the logo mark and footer stay put —
 * on `.nav-scroll`, same as the other two variants, which fades the cut-off edge
 * instead of cutting a hard line across a 72px rail.
 *
 * `items` arrives already filtered to what this member may open, so the three
 * variants cannot disagree about which sections exist.
 */

type AdminSidebarTabletProps = {
  user: AdminSidebarUser;
  items: AdminNavItem[];
  badges?: AdminNavBadges;
  onOpenAccountMenu?: () => void;
  accountMenuOpen?: boolean;
  onLogout?: () => void;
  className?: string;
};

export function AdminSidebarTablet({
  user,
  items,
  badges,
  onOpenAccountMenu,
  accountMenuOpen,
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

        <nav aria-label="Admin" className="nav-scroll -mr-1.5 min-h-0 w-[calc(100%+0.375rem)] pr-1.5">
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
                    aria-label={
                      count > 0 && item.badge
                        ? `${item.label} — ${count} ${ADMIN_NAV_BADGE_NOUN[item.badge]}`
                        : item.label
                    }
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'press relative flex size-10 items-center justify-center rounded-input bg-white text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                        : 'press relative flex size-10 items-center justify-center rounded-input text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
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
        <AdminSidebarAvatarButton
          user={user}
          onOpenAccountMenu={onOpenAccountMenu}
          accountMenuOpen={accountMenuOpen}
        />

        <button
          type="button"
          onClick={onLogout}
          title="Log out"
          aria-label="Log out"
          className="flex size-8 items-center justify-center rounded-pill text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <LogOut className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
