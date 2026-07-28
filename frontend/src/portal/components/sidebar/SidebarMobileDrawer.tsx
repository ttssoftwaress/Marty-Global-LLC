import { useEffect, useRef } from 'react';
import { LogOut, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import logoWhite from '@/assets/Marty-Logo-White.png';
import { useOverlay } from '@/hooks/useOverlay';
import { NavBadge } from './NavBadge';
import { SidebarUserBlock, type SidebarUser } from './SidebarUserBlock';
import {
  PORTAL_NAV_ITEMS,
  isNavItemActive,
  type PortalNavBadges,
} from './nav-items';
import { isServiceNavItemActive, useServiceNavItems } from './useServiceNavItems';

/*
 * Portal sidebar — mobile (below md). A 280px drawer that slides in over the
 * page behind a scrim. Same nav list as desktop, but the logo row carries a
 * close button and the foot reverses order: logout, a hairline rule,
 * then the user block.
 *
 * The design covers only the open panel; the overlay behaviour it implies —
 * scrim, Escape to close, focus moved into the drawer, background scroll lock
 * — is added here so the drawer is usable and accessible.
 */

type SidebarMobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  user: SidebarUser;
  badges?: PortalNavBadges;
  onLogout?: () => void;
};

export function SidebarMobileDrawer({
  open,
  onClose,
  user,
  badges,
  onLogout,
}: SidebarMobileDrawerProps) {
  const { pathname } = useLocation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Called before the `!open` early return below, so the hook order stays stable
  // across renders whether the drawer is open or not.
  const serviceItems = useServiceNavItems();

  const panelRef = useRef<HTMLElement>(null);

  // Escape, the Tab trap, focus in and back out, and the scroll lock. Focus
  // opens on the close button rather than the logo link that leads the panel.
  useOverlay({ open, onClose, panelRef, initialFocusRef: closeButtonRef });

  useEffect(() => {
    if (!open) return;

    /*
     * Crossing into `md` hides the drawer with `md:hidden` but leaves `open`
     * true, so without this the body stays locked and the tablet/desktop portal
     * cannot scroll. Close on the transition instead.
     */
    const desktop = window.matchMedia('(min-width: 768px)');
    const onBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) onClose();
    };
    desktop.addEventListener('change', onBreakpointChange);

    return () => {
      desktop.removeEventListener('change', onBreakpointChange);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-gray-900/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Portal navigation"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] flex-col justify-between overflow-y-auto bg-primary px-5 pb-8 pt-6 outline-none"
      >
        <div className="flex w-full flex-col gap-7">
          <div className="flex w-full items-center justify-between">
            <Link
              to="/app"
              onClick={onClose}
              aria-label="Marty Global LLC — Dashboard"
              className="shrink-0"
            >
              <img
                src={logoWhite}
                alt="Marty Global LLC"
                className="h-[2.875rem] w-[9.25rem] object-contain"
              />
            </Link>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="flex size-[1.625rem] shrink-0 items-center justify-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Portal" className="w-full">
            <ul className="flex w-full flex-col gap-1">
              {PORTAL_NAV_ITEMS.map((item) => {
                const active = isNavItemActive(item.to, pathname);
                const Icon = item.icon;

                return (
                  <li key={item.to} className="w-full">
                    <NavLink
                      to={item.to}
                      end={item.to === '/app'}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={
                        active
                          ? 'flex w-full items-center gap-3 rounded-input bg-white px-4 py-3 text-body font-semibold text-primary [&>svg]:text-accent'
                          : 'flex w-full items-center gap-3 rounded-input px-4 py-3 text-body font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white'
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

            {/* The customer's own delivered services — things they OWN, as
             * distinct from the actions above. */}
            {serviceItems.length > 0 ? (
              <div className="mt-5 flex w-full flex-col gap-1">
                <p className="px-4 pb-1 text-caption font-semibold uppercase tracking-[0.6px] text-white/50">
                  My services
                </p>

                {serviceItems.map((item) => {
                  const active = isServiceNavItemActive(item.to, pathname);
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={
                        active
                          ? 'flex w-full items-center gap-3 rounded-input bg-white px-4 py-3 text-body font-semibold text-primary [&>svg]:text-accent'
                          : 'flex w-full items-center gap-3 rounded-input px-4 py-3 text-body font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white'
                      }
                    >
                      <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span className="min-w-0 flex-1 break-words">{item.label}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${
                          active ? 'bg-primary-light text-primary' : 'bg-white/15 text-white'
                        }`}
                      >
                        {item.count}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            ) : null}
          </nav>
        </div>

        <div className="flex w-full flex-col gap-6 pt-8">
          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-2 text-body font-medium text-white/80 transition-colors hover:text-white"
            >
              <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="whitespace-nowrap">Logout</span>
            </button>
          </div>

          <hr className="w-full border-0 border-t border-white/15" />

          <SidebarUserBlock user={user} />
        </div>
      </aside>
    </div>
  );
}
