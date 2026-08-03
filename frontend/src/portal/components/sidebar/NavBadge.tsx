/*
 * The unread bubble on a sidebar nav item.
 *
 * Deliberately the same shape as the service-count pill beside it, so the two
 * kinds of number on this nav read as one system: the accent fill is what marks
 * this one as "unread, act on it" rather than "here is how many you own". Accent
 * on both the navy nav and the white active pill, so it needs no active variant
 * — it is the one element that looks the same either way, which is the point.
 *
 * Renders nothing at zero — an empty bubble reads as a badge whose number failed
 * to load. Clamped at 9+ like the bell's, because the pill sits inside a fixed
 * nav width and a four-digit count would push the label out of it.
 */

type NavBadgeProps = {
  count: number;
  /*
   * Set where the count is already in the control's own accessible name — the
   * tablet rail, whose tiles have no visible label and say "Support — 3 unread"
   * instead. Announcing it twice is worse than not drawing it at all.
   */
  decorative?: boolean;
  className?: string;
};

export function NavBadge({ count, decorative, className }: NavBadgeProps) {
  if (count <= 0) return null;

  return (
    /*
     * Keyed on the count so a message arriving over the socket replays the pop
     * — the badge is the only thing on screen that moves when the number does,
     * and without it a live update is indistinguishable from a stale render.
     */
    <span
      key={count}
      aria-hidden={decorative ? 'true' : undefined}
      className={`inline-flex min-w-5 shrink-0 animate-pop items-center justify-center rounded-pill bg-accent px-1.5 py-0.5 text-caption font-semibold leading-none text-white motion-reduce:animate-none ${className ?? ''}`}
    >
      {count > 9 ? '9+' : count}
      {/* The number alone reads as "9" to a screen reader with no idea what of. */}
      {decorative ? null : <span className="sr-only"> unread</span>}
    </span>
  );
}
