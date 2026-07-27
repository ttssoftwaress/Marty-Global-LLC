import { useEffect, useRef } from 'react';

import type { AdminNotification } from '../../types/notifications';
import { AdminNotificationPanelContent } from './AdminNotificationPanelContent';

/*
 * The notification surface opened from the admin top bar's bell. One overlay,
 * two chromes by viewport:
 *   - tablet/desktop: a floating dropdown anchored under the bell at the top
 *     right, capped in height so a long feed scrolls inside it
 *   - mobile: a bottom sheet rising from the bottom edge with a drag handle
 *
 * Both sit over a scrim that dismisses on click, close on Esc, move focus into
 * the panel, lock background scroll while open, and animate in respecting
 * reduced motion — the same overlay posture as the admin sidebar's mobile
 * drawer. The two render as siblings and swap at `md` rather than one panel
 * reflowing, since a corner dropdown and a full-width sheet share no
 * positioning.
 *
 * The dropdown's `top-navbar` / `right-6` / `lg:right-8` anchor tracks the admin
 * top bar, which is `h-navbar` with `px-6` at md and `px-8` at lg — so the panel
 * hangs directly beneath the bell at both widths. Mobile's bar is shorter
 * (`h-14`), but the sheet rises from the bottom, so that never matters.
 */

type AdminNotificationsPanelProps = {
  open: boolean;
  onClose: () => void;
  notifications: AdminNotification[];
  isLoading?: boolean;
  onSelect?: (notification: AdminNotification) => void;
  onMarkAllRead?: () => void;
};

// Notification preferences live under admin settings; "View all" opens the full
// feed. Admin settings is still a placeholder screen, which is where the gear
// lands until it is built.
const SETTINGS_HREF = '/admin/settings';
const VIEW_ALL_HREF = '/admin/notifications';

export function AdminNotificationsPanel({
  open,
  onClose,
  notifications,
  isLoading,
  onSelect,
  onMarkAllRead,
}: AdminNotificationsPanelProps) {
  const dropdownRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  // Esc closes from anywhere while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Move focus into whichever panel is on screen and lock background scroll for
  // the overlay's lifetime.
  useEffect(() => {
    if (!open) return;
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    (isDesktop ? dropdownRef : sheetRef).current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) return null;

  const content = (variant: 'dropdown' | 'sheet') => (
    <AdminNotificationPanelContent
      notifications={notifications}
      isLoading={isLoading}
      variant={variant}
      settingsHref={SETTINGS_HREF}
      viewAllHref={VIEW_ALL_HREF}
      onSelect={onSelect}
      onMarkAllRead={onMarkAllRead}
      onDismiss={onClose}
    />
  );

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-gray-900/50 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none md:bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Tablet & desktop — dropdown anchored under the bell, top right */}
      <section
        ref={dropdownRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        tabIndex={-1}
        className="absolute right-6 top-navbar hidden max-h-[calc(100dvh-var(--spacing-navbar)-24px)] w-[400px] translate-y-0 flex-col overflow-clip rounded-card border border-gray-200 bg-white opacity-100 shadow-md-elevation outline-none transition-[opacity,transform] duration-200 ease-out starting:-translate-y-2 starting:opacity-0 motion-reduce:transition-none md:flex lg:right-8 lg:w-[380px] lg:shadow-lg-elevation"
      >
        {content('dropdown')}
      </section>

      {/* Mobile — bottom sheet rising from the bottom edge */}
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] translate-y-0 flex-col rounded-t-modal bg-white outline-none shadow-[0px_-4px_15px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out starting:translate-y-full motion-reduce:transition-none md:hidden"
      >
        <div className="flex shrink-0 flex-col items-center py-2">
          <span className="h-1 w-8 rounded-pill bg-gray-300" aria-hidden="true" />
        </div>
        {content('sheet')}
      </section>
    </div>
  );
}
