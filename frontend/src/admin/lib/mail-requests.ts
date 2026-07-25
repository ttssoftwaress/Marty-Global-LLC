import { Check, Clock, Download, Loader, Send, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type {
  MailLogAction,
  MailRequestStatus,
  MailRequestType,
} from '../types/mailroom';

/*
 * Presentation for the pending-requests queue: which glyph and which tint each
 * request type and status wears.
 *
 * The design's icons are read for intent and mapped to lucide (Design.md) —
 * paper-plane → `Send`, bin → `Trash2`, clock → `Clock`, spinner → `Loader`,
 * tick → `Check`.
 *
 * Both maps fall back to a neutral entry rather than being exhaustive lookups,
 * so a type or status the backend adds later renders as a plain grey badge
 * instead of an unstyled one or a crash.
 */

type BadgeStyle = {
  icon: LucideIcon;
  className: string;
};

const NEUTRAL: BadgeStyle = {
  icon: Clock,
  className: 'bg-gray-100 text-gray-600',
};

const REQUEST_TYPE_STYLES: Record<MailRequestType, BadgeStyle> = {
  forwarding: { icon: Send, className: 'bg-primary-light text-primary' },
  shredding: { icon: Trash2, className: 'bg-[#fee2e2] text-[#b91c1c]' },
};

/*
 * The status tints reuse the design system's status tokens: pending is the
 * `review` amber pair, completed is the solid navy `completed` pair. Processing
 * has no token of its own, so it takes the info hue the design draws (a sky
 * tint with `--color-info` text).
 */
const REQUEST_STATUS_STYLES: Record<MailRequestStatus, BadgeStyle> = {
  pending: {
    icon: Clock,
    className:
      'bg-[var(--color-status-review-bg)] text-[var(--color-status-review-text)]',
  },
  processing: { icon: Loader, className: 'bg-[#e0f2fe] text-info' },
  completed: {
    icon: Check,
    className:
      'bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]',
  },
};

export function requestTypeStyle(type: MailRequestType): BadgeStyle {
  return REQUEST_TYPE_STYLES[type] ?? NEUTRAL;
}

export function requestStatusStyle(status: MailRequestStatus): BadgeStyle {
  return REQUEST_STATUS_STYLES[status] ?? NEUTRAL;
}

/*
 * A completed request has nothing left to work, so its row offers "View"
 * instead of "Process" — the outlined secondary button the design draws.
 */
export function isRequestActionable(status: MailRequestStatus) {
  return status !== 'completed';
}

/*
 * The mail log's "Final action" badge — how a closed item was disposed of.
 *
 * A separate map from the request-type one above even though "forwarded" and
 * "shredded" echo the queue's two types: the log tints forwarded green (a
 * settled outcome) where the queue tints forwarding navy (an outstanding job),
 * and the log carries a third action the queue has no equivalent for. Folding
 * them together would mean one map serving two different meanings.
 *
 * Icons are read from the design for intent and mapped to lucide (Design.md):
 * paper-plane → `Send`, bin → `Trash2`, down-arrow tray → `Download`.
 */
const MAIL_LOG_ACTION_STYLES: Record<MailLogAction, BadgeStyle> = {
  forwarded: {
    icon: Send,
    className:
      'bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]',
  },
  shredded: { icon: Trash2, className: 'bg-gray-100 text-gray-600' },
  downloaded: { icon: Download, className: 'bg-[#e0f2fe] text-info' },
};

export function mailLogActionStyle(action: MailLogAction): BadgeStyle {
  return MAIL_LOG_ACTION_STYLES[action] ?? NEUTRAL;
}
