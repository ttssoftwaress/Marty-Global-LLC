import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
  parseISO,
} from 'date-fns';

import type { Money } from '../types/dashboard';

/*
 * Render-time formatting for the admin portal. Money is stored as integer minor
 * units, so the division here is the single place a value becomes a float — for
 * display only, never for arithmetic (AGENTS.md, Money rules).
 *
 * Mirrors the portal's `lib/format`; the two areas never import from each other
 * (AGENTS.md, route-group rule), so each keeps its own copy.
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

/*
 * Revenue headlines read as whole dollars in the design ("$47,850"), so the KPI
 * value drops the cents while the caption and any detail view keep them.
 */
export function formatMoneyCompact({ amount, currency }: Money) {
  const exponent = MINOR_UNIT_EXPONENT[currency] ?? 2;

  if (currency === 'USDT') return formatMoney({ amount, currency });

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 10 ** exponent);
}

// Counts on the KPI cards and status blocks are grouped ("1,247").
export function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

/*
 * The activity feed's timestamp — the spelled-out "time since" the desktop
 * design shows down the list: "2 min ago", "1 hr ago", "4 hrs ago", falling
 * back to an absolute date once past a week.
 */
export function formatActivityTime(iso: string) {
  const date = parseISO(iso);
  const now = new Date();

  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;

  const days = differenceInDays(now, date);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  return format(date, 'MMM d');
}

/*
 * Absolute dates in the orders queue — "Jul 15, 2026". Timestamps arrive as UTC
 * (AGENTS.md, Dates); `parseISO` converts to the viewer's zone, which is the
 * only place that conversion happens.
 */
export function formatOrderDate(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy');
}

/*
 * The tight variant tablet and mobile use in the same feed ("2m ago", "1h
 * ago"), where the row has to fit a timestamp beside wrapping copy.
 */
export function formatActivityTimeShort(iso: string) {
  const date = parseISO(iso);
  const now = new Date();

  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours}h ago`;

  const days = differenceInDays(now, date);
  if (days < 7) return `${days}d ago`;

  return format(date, 'MMM d');
}
