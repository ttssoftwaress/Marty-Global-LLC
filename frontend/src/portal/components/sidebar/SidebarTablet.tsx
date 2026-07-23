import { HelpCircle, LogOut } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { PORTAL_NAV_ITEMS, PORTAL_SUPPORT_LINK, isNavItemActive } from './nav-items';

/*
 * Portal sidebar — tablet (md up to lg). A 72px icon rail: no logo, no labels,
 * no user block. Nav icons sit in 48px rounded squares; the active one is a
 * white tile with a navy glyph. Support and logout are 40px pills at the foot.
 *
 * Labels are invisible here, so every control carries its nav label as both an
 * accessible name and a native tooltip — otherwise the rail is unusable with a
 * screen reader and ambiguous with a mouse.
 */

type SidebarTabletProps = {
  onLogout?: () => void;
  className?: string;
};

export function SidebarTablet({ onLogout, className }: SidebarTabletProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className={`flex h-full w-[72px] flex-col justify-between bg-primary px-3 py-8 ${className ?? ''}`}
    >
      <nav aria-label="Portal" className="w-full">
        <ul className="flex w-full flex-col items-center gap-3">
          {PORTAL_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item.to, pathname);
            const Icon = item.icon;

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/app'}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'flex size-12 items-center justify-center rounded-xl bg-white text-primary'
                      : 'flex size-12 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white'
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
        <NavLink
          to={PORTAL_SUPPORT_LINK.to}
          title={PORTAL_SUPPORT_LINK.label}
          aria-label={PORTAL_SUPPORT_LINK.label}
          className="flex size-10 items-center justify-center rounded-[20px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <HelpCircle className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </NavLink>

        <button
          type="button"
          onClick={onLogout}
          title="Logout"
          aria-label="Logout"
          className="flex size-10 items-center justify-center rounded-[20px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
