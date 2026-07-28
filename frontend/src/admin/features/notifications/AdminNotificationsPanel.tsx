import { useRef } from 'react';

import { useOverlay } from '../../../hooks/useOverlay';
import type { AdminNotification } from '../../types/notifications';
import { AdminNotificationPanelContent } from './AdminNotificationPanelContent';

/*
 * The notification surface opened from the admin top bar's bell. One overlay,
 * two chromes by viewport:
 *   - tablet/desktop: a floating dropdown anchored under the bell at the top
 *     right, capped in height so a long feed scrolls inside it
 *   - mobile: a bottom sheet rising from the bottom edge with a drag handle
 *
 * It sits over a scrim that dismisses on click and animates in respecting
 * reduced motion — the same overlay posture as the admin sidebar's mobile
 * drawer.
 *
 * Deliberately one element that changes shape at `md` rather than a `md:hidden`
 * pair: two mounted nodes both claiming `aria-modal="true"` is ambiguous to a
 * screen reader, and it forced the focus logic to guess at effect time (via
 * `matchMedia`) which of the two was the visible one. `useOverlay` now owns
 * Escape, the Tab trap, focus into the panel, focus back to the bell on close,
 * and the scroll lock.
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

      {/*
       * Mobile is the base — a bottom sheet rising from the bottom edge. From
       * `md` up the same element becomes the dropdown anchored under the bell at
       * the top right. The two chromes share no positioning, so every
       * axis (inset, size, radius, shadow, and the entrance transition) is
       * restated at the breakpoint.
       */}
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] translate-y-0 flex-col rounded-t-modal bg-white outline-none shadow-[0px_-0.25rem_0.9375rem_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out starting:translate-y-full motion-reduce:transition-none md:inset-x-auto md:bottom-auto md:right-6 md:top-navbar md:max-h-[calc(100dvh-var(--spacing-navbar)-1.5rem)] md:w-[25rem] md:overflow-clip md:rounded-card md:border md:border-gray-200 md:opacity-100 md:shadow-md-elevation md:transition-[opacity,transform] md:duration-200 md:starting:-translate-y-2 md:starting:opacity-0 lg:right-8 lg:w-[23.75rem] lg:shadow-lg-elevation"
      >
        {/* The sheet's drag handle — the dropdown has no such affordance. */}
        <div className="flex shrink-0 flex-col items-center py-2 md:hidden">
          <span className="h-1 w-8 rounded-pill bg-gray-300" aria-hidden="true" />
        </div>
        <AdminNotificationPanelContent
          notifications={notifications}
          isLoading={isLoading}
          variant="sheet"
          settingsHref={SETTINGS_HREF}
          viewAllHref={VIEW_ALL_HREF}
          onSelect={onSelect}
          onMarkAllRead={onMarkAllRead}
          onDismiss={onClose}
        />
      </section>
    </div>
  );
}
