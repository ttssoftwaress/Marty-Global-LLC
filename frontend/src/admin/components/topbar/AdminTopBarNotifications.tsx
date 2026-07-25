import { Bell } from 'lucide-react';

/*
 * Admin top bar notifications bell — the glyph with an overlapping count badge
 * pinned to its top-right corner. Desktop and tablet draw a 22px bell, mobile a
 * 20px one; the badge is 16px at every width.
 *
 * The badge red in all three Figma links is #dc2626, which is the design
 * system's `error` token — so it renders as `bg-error` rather than a literal hex.
 *
 * Counts above 9 would overflow the 16px badge, so they clamp to "9+", and a zero
 * count hides the badge entirely — neither state is in the design.
 */

type AdminTopBarNotificationsProps = {
  count?: number;
  onOpenNotifications?: () => void;
  /** Mobile draws a 20px bell instead of 22px. */
  compact?: boolean;
};

export function AdminTopBarNotifications({
  count = 0,
  onOpenNotifications,
  compact = false,
}: AdminTopBarNotificationsProps) {
  return (
    <button
      type="button"
      onClick={onOpenNotifications}
      aria-label={count > 0 ? `Notifications — ${count} unread` : 'Notifications'}
      className="relative flex size-6 shrink-0 items-center justify-center text-gray-700 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Bell
        className={compact ? 'size-5' : 'size-[22px]'}
        strokeWidth={1.75}
        aria-hidden="true"
      />

      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-pill bg-error px-0.5 text-[10px] font-bold leading-none text-white"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
