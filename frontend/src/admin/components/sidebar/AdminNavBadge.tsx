/*
 * The unread bubble on an admin sidebar nav item.
 *
 * The portal has its own copy of this — areas never import from each other
 * (Design.md), so a pattern both need is implemented in each rather than shared
 * across the boundary.
 *
 * Renders nothing at zero: an empty bubble reads as a badge whose number failed
 * to load. Clamped at 9+ like the bell's, because the pill sits inside a fixed
 * nav width and a four-digit count would push the label out of it.
 */

type AdminNavBadgeProps = {
  count: number;
  /*
   * Set where the count is already in the control's own accessible name — the
   * tablet rail, whose tiles have no visible label. Announcing it twice is worse
   * than not drawing it at all.
   */
  decorative?: boolean;
  className?: string;
};

export function AdminNavBadge({ count, decorative, className }: AdminNavBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      className={`inline-flex min-w-5 shrink-0 items-center justify-center rounded-pill bg-accent px-1.5 py-0.5 text-caption font-semibold leading-none text-white ${className ?? ''}`}
    >
      {count > 9 ? '9+' : count}
      {/* The number alone reads as "9" to a screen reader with no idea what of. */}
      {decorative ? null : <span className="sr-only"> unread</span>}
    </span>
  );
}
