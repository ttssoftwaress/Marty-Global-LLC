import { useRef } from 'react';
import { Bell, LogOut, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useOverlay } from '@/hooks/useOverlay';
import { adminUserInitials, type AdminSidebarUser } from '../sidebar';

/*
 * The account surface opened from the profile avatar — the top bar's on every
 * width, the sidebar user block's on desktop and in the mobile drawer, and the
 * tablet rail's avatar.
 *
 * Same overlay posture as the admin notifications panel, deliberately: one
 * element that changes shape at `md` rather than a `md:hidden` pair, because two
 * mounted nodes both claiming `aria-modal="true"` is ambiguous to a screen reader
 * and forces the focus logic to guess which one is visible.
 *   - mobile: a bottom sheet rising from the bottom edge with a drag handle
 *   - tablet/desktop: a floating dropdown anchored to whichever control opened it
 *
 * `useOverlay` owns Escape, the Tab trap, focus into the panel, focus back to
 * the avatar on close, and the scroll lock.
 *
 * Mirrors the portal's `AccountMenu`; the two areas never import from each other
 * (AGENTS.md, route-group rule), so each keeps its own copy — and the lists they
 * offer are different anyway.
 */

export type AdminAccountMenuAnchor = 'topbar' | 'sidebar';

type AdminAccountMenuProps = {
  open: boolean;
  onClose: () => void;
  anchor: AdminAccountMenuAnchor;
  user: AdminSidebarUser;
  /* The member's permission areas, `undefined` while `/admin/me` is in flight. */
  permissions?: readonly string[];
  onLogout?: () => void;
};

type AdminAccountLink = {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
};

/*
 * Gated exactly like the nav (`nav-items.ts`): a member who does not hold an
 * area must not be offered a link that 403s on arrival. The notification inbox is
 * their own, so it is un-narrowed on the backend too and carries no area here.
 */
const ADMIN_ACCOUNT_LINKS: AdminAccountLink[] = [
  { label: 'My notifications', to: '/admin/notifications', icon: Bell },
  {
    label: 'Admin settings',
    to: '/admin/settings',
    icon: Settings,
    permission: 'settings',
  },
];

/* Mobile is the base: a sheet rising from the bottom edge, full width. */
const SHEET =
  'absolute inset-x-0 bottom-0 flex max-h-[85dvh] translate-y-0 flex-col rounded-t-modal bg-white outline-none shadow-[0px_-0.25rem_0.9375rem_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out starting:translate-y-full motion-reduce:transition-none';

/* From `md` up the same element becomes a floating card. */
const DROPDOWN =
  'md:inset-x-auto md:w-[18.5rem] md:overflow-clip md:rounded-card md:border md:border-gray-200 md:opacity-100 md:shadow-md-elevation md:transition-[opacity,transform] md:duration-200 md:starting:opacity-0 lg:shadow-lg-elevation';

const ANCHOR_CLASSES: Record<AdminAccountMenuAnchor, string> = {
  /* Under the top bar at its right edge — `h-navbar` with matching side padding. */
  topbar:
    'md:bottom-auto md:right-6 md:top-navbar md:max-h-[calc(100dvh-var(--spacing-navbar)-1.5rem)] md:starting:-translate-y-2 lg:right-8',
  /* Beside the sidebar, bottom-aligned with its user block: the tablet rail is
   * 4.5rem wide and the desktop sidebar is `--spacing-sidebar`, each plus a
   * 0.5rem gap so the card floats over the workspace rather than the navy. */
  sidebar:
    'md:bottom-4 md:left-20 md:right-auto md:top-auto md:max-h-[calc(100dvh-2rem)] md:starting:translate-y-2 lg:bottom-6 lg:left-[calc(var(--spacing-sidebar)+0.5rem)]',
};

export function AdminAccountMenu({
  open,
  onClose,
  anchor,
  user,
  permissions,
  onLogout,
}: AdminAccountMenuProps) {
  const panelRef = useRef<HTMLElement>(null);

  useOverlay({ open, onClose, panelRef });

  if (!open) return null;

  const links = ADMIN_ACCOUNT_LINKS.filter(
    (link) => !link.permission || permissions?.includes(link.permission),
  );

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-gray-900/50 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none md:bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        tabIndex={-1}
        className={`${SHEET} ${DROPDOWN} ${ANCHOR_CLASSES[anchor]}`}
      >
        {/* The sheet's drag handle — the dropdown has no such affordance. */}
        <div className="flex shrink-0 flex-col items-center py-2 md:hidden">
          <span className="h-1 w-8 rounded-pill bg-gray-300" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 pb-4 md:py-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="size-10 shrink-0 rounded-pill object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-light text-body font-semibold text-primary"
            >
              {adminUserInitials(user.name)}
            </span>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-body font-semibold text-text">{user.name}</p>
            {/* The job role stands in until `/admin/me` lands the address —
             * a blank line would read as an account with no email. */}
            <p className="truncate text-small text-gray-500">
              {user.email ?? user.role}
            </p>
          </div>
        </div>

        <nav aria-label="Account" className="min-h-0 flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col">
            {links.map((item) => {
              const Icon = item.icon;

              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    className="flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-body font-medium text-text transition-colors hover:bg-gray-50 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Icon
                      className="size-[1.125rem] shrink-0 text-gray-500"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-gray-200 p-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout?.();
            }}
            className="flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-body font-medium text-error transition-colors hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
          >
            <LogOut className="size-[1.125rem] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </section>
    </div>
  );
}
