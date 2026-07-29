import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInWeeks,
  format,
  parseISO,
} from 'date-fns';

/*
 * The customers list' "last activity" phrasing — the spelled-out time-since the
 * links print down the column: "2 hours ago", "Yesterday", "5 days ago",
 * "3 weeks ago".
 *
 * The admin feed's `formatActivityTime` abbreviates ("2 hrs ago") to fit a
 * narrow feed row; this column has the width for the full word and the design
 * uses it, so the two phrasings live side by side rather than one bending to
 * cover both.
 *
 * Timestamps arrive as UTC (AGENTS.md, Dates); `parseISO` converts to the
 * viewer's zone, which is the only place that conversion happens. A customer who
 * has never been seen has no timestamp at all, and reads as such.
 */

export function formatLastActivity(iso: string | null): string {
  if (!iso) return 'No activity yet';

  const date = parseISO(iso);
  const now = new Date();

  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = differenceInDays(now, date);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  const weeks = differenceInWeeks(now, date);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

  return format(date, 'MMM d, yyyy');
}
