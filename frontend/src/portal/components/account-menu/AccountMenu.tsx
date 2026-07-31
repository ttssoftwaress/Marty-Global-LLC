import { useRef } from 'react';
import { Bell, CreditCard, LogOut, ShieldCheck, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useOverlay } from '@/hooks/useOverlay';
import { portalUserInitials, type SidebarUser } from '../sidebar';

/*
 * The account surface opened from the profile avatar — the top bar's on every
 * width, and the sidebar user block's on desktop and in the mobile drawer.
 *
 * Same overlay posture as the notifications panel, deliberately: one element
 * that changes shape at `md` rather than a `md:hidden` pair, because two mounted
 * nodes both claiming `aria-modal="true"` is ambiguous to a screen reader and
 * forces the focus logic to guess at effect time which one is visible.
 *   - mobile: a bottom sheet rising from the bottom edge with a drag handle
 *   - tablet/desktop: a floating dropdown, anchored to whichever control opened
 *     it (see `anchor`)
 *
 * `useOverlay` owns Escape, the Tab trap, focus into the panel, focus back to
 * the avatar on close, and the scroll lock.
 *
 * The two anchors exist because the two triggers sit at opposite corners: the
 * top bar's avatar is top-right, so the panel hangs under the bar; the sidebar's
 * user block is bottom-left, so the panel flies out to the right of the navy
 * column and is bottom-aligned to it. A single top-right anchor would leave the
 * sidebar's menu detached from the control that opened it.
 */

export type AccountMenuAnchor = 'topbar' | 'sidebar';

type AccountMenuProps = {
  open: boolean;
  onClose: () => void;
  anchor: AccountMenuAnchor;
  user: SidebarUser;
  onLogout?: () => void;
};

type AccountLink = {
  label: string;
  to: string;
  icon: LucideIcon;
};

/*
 * Destinations that are about the person rather than their work — which is why
 * this list is not the sidebar's nav list with a few entries removed. The three
 * settings rows deep-link into `?section=`, the same param the settings screen
 * reconciles its master/detail split from, so each one lands on its own frame
 * rather than the default Profile tab.
 */
const ACCOUNT_LINKS: AccountLink[] = [
  { label: 'Account settings', to: '/app/settings?section=profile', icon: User },
  { label: 'Password & security', to: '/app/settings?section=security', icon: ShieldCheck },
  {
    label: 'Notification preferences',
    to: '/app/settings?section=notifications',
    icon: Bell,
  },
  { label: 'Billing & payments', to: '/app/billing', icon: CreditCard },
];

/* Mobile is the base: a sheet rising from the bottom edge, full width. */
const SHEET =
  'absolute inset-x-0 bottom-0 flex max-h-[85dvh] translate-y-0 flex-col rounded-t-modal bg-white outline-none shadow-[0px_-0.25rem_0.9375rem_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out starting:translate-y-full motion-reduce:transition-none';

/* From `md` up the same element becomes a floating card. */
const DROPDOWN =
  'md:inset-x-auto md:w-[18.5rem] md:overflow-clip md:rounded-card md:border md:border-gray-200 md:opacity-100 md:shadow-md-elevation md:transition-[opacity,transform] md:duration-200 md:starting:opacity-0 lg:shadow-lg-elevation';

const ANCHOR_CLASSES: Record<AccountMenuAnchor, string> = {
  /*
   * Under the top bar at its right edge. `top-navbar` with `right-6` / `lg:right-8`
   * tracks the bar itself, which is `h-navbar` with matching side padding.
   */
  topbar:
    'md:bottom-auto md:right-6 md:top-navbar md:max-h-[calc(100dvh-var(--spacing-navbar)-1.5rem)] md:starting:-translate-y-2 lg:right-8',
  /*
   * Beside the sidebar, bottom-aligned with its user block. The tablet rail is
   * 4.5rem wide and the desktop sidebar is `--spacing-sidebar`; both get a 0.5rem
   * gap so the card reads as floating over the workspace, not glued to the navy.
   */
  sidebar:
    'md:bottom-4 md:left-20 md:right-auto md:top-auto md:max-h-[calc(100dvh-2rem)] md:starting:translate-y-2 lg:bottom-6 lg:left-[calc(var(--spacing-sidebar)+0.5rem)]',
};

export function AccountMenu({
  open,
  onClose,
  anchor,
  user,
  onLogout,
}: AccountMenuProps) {
  const panelRef = useRef<HTMLElement>(null);

  useOverlay({ open, onClose, panelRef });

  if (!open) return null;

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
              {portalUserInitials(user.name)}
            </span>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-body font-semibold text-text">{user.name}</p>
            {/* Absent for the moment the shell has a session but not yet the
             * profile record the email rides on — a blank line would read as an
             * account with no address. */}
            {user.email ? (
              <p className="truncate text-small text-gray-500">{user.email}</p>
            ) : (
              <p className="truncate text-small text-gray-500">{user.role}</p>
            )}
          </div>
        </div>

        <nav aria-label="Account" className="min-h-0 flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col">
            {ACCOUNT_LINKS.map((item) => {
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
            <span>Logout</span>
          </button>
        </div>
      </section>
    </div>
  );
}
