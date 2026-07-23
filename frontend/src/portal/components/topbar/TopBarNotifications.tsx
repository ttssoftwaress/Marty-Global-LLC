import { Bell } from 'lucide-react';

/*
 * Top bar notifications bell — 24px glyph with an overlapping count badge that
 * sits at the top-right of the icon.
 *
 * The three Figma links each use a slightly different red for the badge
 * (#ef4444 / #dc2626 / #b91c1c). That reads as drift rather than intent, so all
 * three breakpoints render the design system's `error` token instead — logged
 * as a deviation.
 *
 * Counts above 9 would overflow the 16px badge, so they clamp to "9+"; a zero
 * count hides the badge entirely — neither state is in the design.
 */

type TopBarNotificationsProps = {
  count?: number;
  onOpenNotifications?: () => void;
  /** Mobile draws a slightly smaller badge (14px vs 16px). */
  compact?: boolean;
};

export function TopBarNotifications({
  count = 0,
  onOpenNotifications,
  compact = false,
}: TopBarNotificationsProps) {
  const label =
    count > 0
      ? `Notifications — ${count} unread`
      : 'Notifications';

  return (
    <button
      type="button"
      onClick={onOpenNotifications}
      aria-label={label}
      className="relative flex size-6 shrink-0 items-center justify-center rounded-pill text-gray-600 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Bell className="size-6" strokeWidth={1.75} aria-hidden="true" />

      {count > 0 && (
        <span
          aria-hidden="true"
          className={
            compact
              ? 'absolute -top-0.5 left-3 flex size-[14px] items-center justify-center rounded-pill bg-error px-0.5 text-[9px] font-bold leading-none text-white'
              : 'absolute -top-0.5 left-3 flex size-4 items-center justify-center rounded-pill bg-error px-0.5 text-[10px] font-bold leading-none text-white'
          }
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
