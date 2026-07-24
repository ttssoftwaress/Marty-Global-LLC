import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  format,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';

import type { Money } from '../types/dashboard';

/*
 * Render-time formatting for the portal. Money is stored as integer minor
 * units, so the division here is the single place a value becomes a float —
 * for display only, never for arithmetic (AGENTS.md, Money rules).
 */

const MINOR_UNIT_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  USDT: 6,
};

export function formatMoney({ amount, currency }: Money) {
  const exponent = MINOR_UNIT_EXPONENT[currency] ?? 2;

  // USDT is not an ISO 4217 code, so Intl cannot resolve it as a currency.
  if (currency === 'USDT') {
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: exponent,
    }).format(amount / 10 ** exponent)} USDT`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amount / 10 ** exponent);
}

export function formatOrderDate(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy');
}

// A file's size for display next to its name (e.g. "1.2 MB"). Bytes are a count,
// not money, so plain math is fine here. Steps up KB/MB/GB and drops the decimal
// for whole values so "1.0 MB" reads as "1 MB".
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const rounded = Math.round(size * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${units[unitIndex]}`;
}

export function formatRelativeTime(iso: string) {
  return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
}

// Compact "time since" for tight metadata rows (e.g. a conversation list's
// last-activity stamp): "now", "5m ago", "2h ago", "1d ago", "3w ago", falling
// back to an absolute "Sep 14" once past a month.
export function formatRelativeTimeShort(iso: string) {
  const date = parseISO(iso);
  const now = new Date();

  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours}h ago`;

  const days = differenceInDays(now, date);
  if (days < 7) return `${days}d ago`;

  const weeks = differenceInWeeks(now, date);
  if (weeks < 5) return `${weeks}w ago`;

  return format(date, 'MMM d');
}

/*
 * The notification feed's timestamp — the abbreviated, human "time since" the
 * design shows down the list: "2 min ago", "1 hr ago", "Yesterday", "3 days
 * ago", "1 week ago", "6 weeks ago", "3 months ago". Distinct from
 * `formatRelativeTimeShort` (the tight "2m/1h" panel form) — this is the roomier
 * spelled-out variant the full page uses.
 */
export function formatFeedTime(iso: string) {
  const date = parseISO(iso);
  const now = new Date();

  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;

  if (isYesterday(date)) return 'Yesterday';

  const days = differenceInDays(now, date);
  if (days < 7) return `${days} days ago`;

  const weeks = differenceInWeeks(now, date);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

  const months = differenceInMonths(now, date);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = differenceInYears(now, date);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

// A message's clock time within a thread — "10:24 AM".
export function formatMessageTime(iso: string) {
  return format(parseISO(iso), 'h:mm a');
}

// The label for a chat day divider: "Today" / "Yesterday", else a full date.
export function formatDayLabel(iso: string) {
  const date = parseISO(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}
