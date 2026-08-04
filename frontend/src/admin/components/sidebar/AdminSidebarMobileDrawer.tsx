import { useRef } from 'react';
import { LogOut, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { useOverlay } from '@/hooks/useOverlay';
import { AdminNavBadge } from './AdminNavBadge';
import { AdminSidebarUserBlock, type AdminSidebarUser } from './AdminSidebarUserBlock';
import {
  isAdminNavItemActive,
  type AdminNavBadges,
  type AdminNavItem,
} from './nav-items';

/*
 * Admin sidebar — mobile (below md). A drawer that slides in over the page
 * behind a scrim, opened by the layout's menu button. Same nav list as desktop,
 * but the brand collapses to a wordmark + "ADMIN PORTAL" eyebrow beside a close
 * button, and the foot puts a hairline rule above the user block and log out.
 *
 * The design covers only the open panel; the overlay behaviour it implies —
 * scrim, Escape to close, focus moved into the drawer, background scroll lock —
 * is added here so the drawer is usable and accessible. The list itself is a
 * `.nav-scroll`, the same port the other two variants use, so a phone in
 * landscape fades the nav where it runs out instead of showing a scrollbar
 * against the navy.
 *
 * `items` arrives already filtered to what this member may open, so the three
 * variants cannot disagree about which sections exist.
 */

type AdminSidebarMobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  user: AdminSidebarUser;
  items: AdminNavItem[];
  badges?: AdminNavBadges;
  /*
   * The shell closes the drawer before opening the account sheet, so the two
   * overlays are never stacked: nesting them would mean two `aria-modal` dialogs
   * at once and an Escape that dismisses both.
   */
  onOpenAccountMenu?: () => void;
  onLogout?: () => void;
};

export function AdminSidebarMobileDrawer({
  open,
  onClose,
  user,
  items,
  badges,
  onOpenAccountMenu,
  onLogout,
}: AdminSidebarMobileDrawerProps) {
  const { pathname } = useLocation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Escape, the Tab trap, focus in and back out, and the scroll lock. Focus
  // opens on the close button rather than the brand link that leads the panel.
  useOverlay({ open, onClose, panelRef, initialFocusRef: closeButtonRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-gray-900/50 transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] translate-x-0 flex-col justify-between bg-primary px-4 py-6 shadow-[0.25rem_0_0.5rem_rgba(0,0,0,0.25)] outline-none transition-transform duration-300 ease-out starting:-translate-x-full motion-reduce:transition-none"
      >
        <div className="flex min-h-0 w-full flex-col gap-6">
          <div className="flex w-full items-start justify-between gap-3">
            <Link
              to="/admin"
              onClick={onClose}
              aria-label="Marty Global LLC — Admin dashboard"
              className="flex min-w-0 flex-col gap-1"
            >
              <span className="truncate text-h5 font-bold text-white">
                Marty Global LLC
              </span>
              <span className="text-caption font-medium uppercase tracking-wide text-white/60">
                Admin portal
              </span>
            </Link>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-pill p-1 text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Admin" className="nav-scroll -mr-2 min-h-0 w-[calc(100%+0.5rem)] pr-2">
            <ul className="flex w-full flex-col gap-1">
              {items.map((item) => {
                const active = isAdminNavItemActive(item.to, pathname);
                const Icon = item.icon;

                return (
                  <li key={item.to} className="w-full">
                    <NavLink
                      to={item.to}
                      end={item.to === '/admin'}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={
                        active
                          ? 'press-soft flex w-full items-center gap-3 rounded-input bg-white px-4 py-3 text-body font-semibold text-primary [&>svg]:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                          : 'press-soft flex w-full items-center gap-3 rounded-input px-4 py-3 text-body font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
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
          <hr className="w-full border-0 border-t border-white/15" />

          <AdminSidebarUserBlock
            user={user}
            onOpenAccountMenu={onOpenAccountMenu}
          />

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 text-body font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="whitespace-nowrap">Log out</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
