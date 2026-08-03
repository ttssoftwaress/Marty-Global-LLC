import { LogOut } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import logoWhite from '@/assets/Marty-Logo-White.png';
import { NavBadge } from './NavBadge';
import { SidebarUserBlock, type SidebarUser } from './SidebarUserBlock';
import {
  PORTAL_NAV_ITEMS,
  isNavItemActive,
  type PortalNavBadges,
} from './nav-items';
import { isServiceNavItemActive, useServiceNavItems } from './useServiceNavItems';

/*
 * Portal sidebar — desktop (lg and up). 280px wide, full-height navy column:
 * logo + nav list pinned to the top, user block + utility links to the bottom.
 * The active item is a white pill with navy label; the rest are 80%-opacity
 * white and lift to full opacity on hover.
 */

type SidebarDesktopProps = {
  user: SidebarUser;
  badges?: PortalNavBadges;
  onOpenAccountMenu?: () => void;
  accountMenuOpen?: boolean;
  onLogout?: () => void;
  className?: string;
};

export function SidebarDesktop({
  user,
  badges,
  onOpenAccountMenu,
  accountMenuOpen,
  onLogout,
  className,
}: SidebarDesktopProps) {
  const { pathname } = useLocation();
  // One entry per service this customer owns records for. Empty until the query
  // resolves, and empty forever for a customer with nothing delivered — the
  // group and its heading disappear together rather than leaving a bare label.
  const serviceItems = useServiceNavItems();

  return (
    <aside
      className={`flex h-full w-sidebar flex-col justify-between bg-primary px-6 py-8 ${className ?? ''}`}
    >
      <div className="flex w-full flex-col gap-8">
        <Link to="/app" aria-label="Marty Global LLC — Dashboard" className="shrink-0">
          <img
            src={logoWhite}
            alt="Marty Global LLC"
            className="h-[2.5625rem] w-[7.25rem] object-contain"
          />
        </Link>

        <nav aria-label="Portal" className="w-full">
          <ul className="flex w-full flex-col gap-2">
            {PORTAL_NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item.to, pathname);
              const Icon = item.icon;

              return (
                <li key={item.to} className="w-full">
                  <NavLink
                    to={item.to}
                    end={item.to === '/app'}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'press-soft flex w-full items-center gap-3 rounded-input bg-white px-4 py-3 text-body font-semibold text-primary [&>svg]:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                        : 'press-soft flex w-full items-center gap-3 rounded-input px-4 py-3 text-body font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                    }
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words">{item.label}</span>
                    {item.badge ? <NavBadge count={badges?.[item.badge] ?? 0} /> : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {/* The customer's own delivered services. A separate list under its own
           * heading rather than more items in the one above: these are things
           * they OWN, while everything above is something they DO. */}
          {serviceItems.length > 0 ? (
            <div className="mt-6 flex w-full flex-col gap-2">
              <p className="px-4 text-caption font-semibold uppercase tracking-[0.6px] text-white/50">
                My services
              </p>

              <ul className="flex w-full flex-col gap-2">
                {serviceItems.map((item) => {
                  const active = isServiceNavItemActive(item.to, pathname);
                  const Icon = item.icon;

                  return (
                    <li key={item.to} className="w-full">
                      <NavLink
                        to={item.to}
                        aria-current={active ? 'page' : undefined}
                        className={
                          active
                            ? 'press-soft flex w-full items-center gap-3 rounded-input bg-white px-4 py-3 text-body font-semibold text-primary [&>svg]:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                            : 'press-soft flex w-full items-center gap-3 rounded-input px-4 py-3 text-body font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                        }
                      >
                        <Icon
                          className="size-5 shrink-0"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 break-words">{item.label}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${
                            active ? 'bg-primary-light text-primary' : 'bg-white/15 text-white'
                          }`}
                        >
                          {item.count}
                        </span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </nav>
      </div>

      <div className="flex w-full flex-col gap-6">
        <SidebarUserBlock
          user={user}
          onOpenAccountMenu={onOpenAccountMenu}
          accountMenuOpen={accountMenuOpen}
        />

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 text-body font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="whitespace-nowrap">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
