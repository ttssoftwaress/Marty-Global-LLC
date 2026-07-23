import { HelpCircle, LogOut } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import logoWhite from '@/assets/Marty-Logo-White.png';
import { SidebarUserBlock, type SidebarUser } from './SidebarUserBlock';
import {
  PORTAL_NAV_ITEMS,
  PORTAL_SUPPORT_LINK,
  isNavItemActive,
} from './nav-items';

/*
 * Portal sidebar — desktop (lg and up). 280px wide, full-height navy column:
 * logo + nav list pinned to the top, user block + utility links to the bottom.
 * The active item is a white pill with navy label; the rest are 80%-opacity
 * white and lift to full opacity on hover.
 */

type SidebarDesktopProps = {
  user: SidebarUser;
  onLogout?: () => void;
  className?: string;
};

export function SidebarDesktop({ user, onLogout, className }: SidebarDesktopProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className={`flex h-full w-sidebar flex-col justify-between bg-primary px-6 py-8 ${className ?? ''}`}
    >
      <div className="flex w-full flex-col gap-8">
        <Link to="/app" aria-label="Marty Global LLC — Dashboard" className="shrink-0">
          <img
            src={logoWhite}
            alt="Marty Global LLC"
            className="h-[41px] w-[116px] object-contain"
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
                        ? 'flex w-full items-center gap-3 rounded-input bg-white px-4 py-3 text-body font-semibold text-primary'
                        : 'flex w-full items-center gap-3 rounded-input px-4 py-3 text-body font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white'
                    }
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="flex w-full flex-col gap-6">
        <SidebarUserBlock user={user} />

        <div className="flex w-full flex-col gap-3">
          <Link
            to={PORTAL_SUPPORT_LINK.to}
            className="flex items-center gap-2 text-body font-medium text-white/80 transition-colors hover:text-white"
          >
            <HelpCircle className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="whitespace-nowrap">{PORTAL_SUPPORT_LINK.label}</span>
          </Link>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 text-body font-medium text-white/80 transition-colors hover:text-white"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="whitespace-nowrap">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
