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
   * What the number counts, for the screen reader — "unread" for the bell's feed,
   * "unassigned" for the support queue. See ADMIN_NAV_BADGE_NOUN.
   */
  noun?: string;
  /*
   * Set where the count is already in the control's own accessible name — the
   * tablet rail, whose tiles have no visible label. Announcing it twice is worse
   * than not drawing it at all.
   */
  decorative?: boolean;
  className?: string;
};

export function AdminNavBadge({
  count,
  noun = 'unread',
  decorative,
  className,
}: AdminNavBadgeProps) {
  if (count <= 0) return null;

  return (
    /*
     * Keyed on the count so a notification arriving over the socket replays the
     * pop — same call the portal's badge makes, and for the same reason: a live
     * update that does not move is indistinguishable from a stale render.
     */
    <span
      key={count}
      aria-hidden={decorative ? 'true' : undefined}
      className={`inline-flex min-w-5 shrink-0 animate-pop items-center justify-center rounded-pill bg-accent px-1.5 py-0.5 text-caption font-semibold leading-none text-white motion-reduce:animate-none ${className ?? ''}`}
    >
      {count > 9 ? '9+' : count}
      {/* The number alone reads as "9" to a screen reader with no idea what of. */}
      {decorative ? null : <span className="sr-only"> {noun}</span>}
    </span>
  );
}
