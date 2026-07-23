import { useEffect, useRef } from 'react';
import { HelpCircle, LogOut, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import logoWhite from '@/assets/Marty-Logo-White.png';
import { SidebarUserBlock, type SidebarUser } from './SidebarUserBlock';
import {
  PORTAL_NAV_ITEMS,
  PORTAL_SUPPORT_LINK,
  isNavItemActive,
} from './nav-items';

/*
 * Portal sidebar — mobile (below md). A 280px drawer that slides in over the
 * page behind a scrim. Same nav list as desktop, but the logo row carries a
 * close button and the foot reverses order: utility links, a hairline rule,
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
  onLogout?: () => void;
};

export function SidebarMobileDrawer({
  open,
  onClose,
  user,
  onLogout,
}: SidebarMobileDrawerProps) {
  const { pathname } = useLocation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
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
        role="dialog"
        aria-modal="true"
        aria-label="Portal navigation"
        className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col justify-between overflow-y-auto bg-primary px-5 pb-8 pt-6"
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
                className="h-[46px] w-[148px] object-contain"
              />
            </Link>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="flex size-[26px] shrink-0 items-center justify-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/20"
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

        <div className="flex w-full flex-col gap-6 pt-8">
          <div className="flex w-full flex-col gap-3">
            <Link
              to={PORTAL_SUPPORT_LINK.to}
              onClick={onClose}
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

          <hr className="w-full border-0 border-t border-white/15" />

          <SidebarUserBlock user={user} />
        </div>
      </aside>
    </div>
  );
}
