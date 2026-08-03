import { LogOut } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { NavBadge } from './NavBadge';
import {
  PORTAL_NAV_ITEMS,
  isNavItemActive,
  type PortalNavBadges,
} from './nav-items';
import { isServiceNavItemActive, useServiceNavItems } from './useServiceNavItems';

/*
 * Portal sidebar — tablet (md up to lg). A 72px icon rail: no logo, no labels,
 * no user block. Nav icons sit in 48px rounded squares; the active one is a
 * white tile with a navy glyph. Logout is a 40px pill at the foot.
 *
 * Labels are invisible here, so every control carries its nav label as both an
 * accessible name and a native tooltip — otherwise the rail is unusable with a
 * screen reader and ambiguous with a mouse.
 */

type SidebarTabletProps = {
  badges?: PortalNavBadges;
  onLogout?: () => void;
  className?: string;
};

export function SidebarTablet({ badges, onLogout, className }: SidebarTabletProps) {
  const { pathname } = useLocation();
  const serviceItems = useServiceNavItems();

  return (
    <aside
      className={`flex h-full w-[4.5rem] flex-col justify-between bg-primary px-3 py-8 ${className ?? ''}`}
    >
      <nav aria-label="Portal" className="w-full">
        <ul className="flex w-full flex-col items-center gap-3">
          {PORTAL_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item.to, pathname);
            const Icon = item.icon;
            const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/app'}
                  title={item.label}
                  /* The rail has no visible labels, so the count has to be in
                   * the accessible name — the badge itself is decorative here. */
                  aria-label={count > 0 ? `${item.label} — ${count} unread` : item.label}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'press relative flex size-12 items-center justify-center rounded-xl bg-white text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                      : 'press relative flex size-12 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                  }
                >
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  {count > 0 ? (
                    <NavBadge
                      count={count}
                      decorative
                      className="pointer-events-none absolute right-1 top-1"
                    />
                  ) : null}
                </NavLink>
              </li>
            );
          })}

          {/* The customer's delivered services. A hairline stands in for the
           * "My services" heading the wider sidebars print — there is no room
           * for a label here, and each tile carries the page name as its
           * accessible name and tooltip. */}
          {serviceItems.length > 0 ? (
            <li aria-hidden="true" className="my-1 w-8 border-t border-white/15" />
          ) : null}

          {serviceItems.map((item) => {
            const active = isServiceNavItemActive(item.to, pathname);
            const Icon = item.icon;

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  title={`${item.label} (${item.count})`}
                  aria-label={`${item.label}, ${item.count} record${item.count === 1 ? '' : 's'}`}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'press flex size-12 items-center justify-center rounded-xl bg-white text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                      : 'press flex size-12 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                  }
                >
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex w-full flex-col items-center gap-4">
        <button
          type="button"
          onClick={onLogout}
          title="Logout"
          aria-label="Logout"
          className="flex size-10 items-center justify-center rounded-[1.25rem] text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <LogOut className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
