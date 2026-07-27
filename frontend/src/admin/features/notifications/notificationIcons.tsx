import {
  CheckCircle,
  FileText,
  Inbox,
  MessageCircle,
  Receipt,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

import type { AdminNotificationCategory } from '../../types/notifications';

/*
 * Category → glyph + tint for a notification row's leading icon.
 *
 * The glyphs are the admin sidebar's, not the customer feed's: a staff member
 * reading "a new order landed" should see the same bag that marks the orders
 * queue in the nav, so the row and the destination read as one thing. That is
 * why `order` is a bag rather than the portal's refresh arrow and `billing` a
 * receipt rather than a dollar sign — the customer sees "my application moved",
 * the operator sees "a queue got longer".
 *
 * Tints are soft background + solid glyph pairs, kept here as one map rather
 * than scattered through the JSX so a category's colour changes in one place.
 * Icons come from lucide-react per Design guide.md — never drawn or exported.
 */

type AdminNotificationIconStyle = {
  Icon: LucideIcon;
  // Tailwind classes for the 32px chip and its glyph.
  wrapClassName: string;
  glyphClassName: string;
};

export const ADMIN_NOTIFICATION_ICONS: Record<
  AdminNotificationCategory,
  AdminNotificationIconStyle
> = {
  order: {
    Icon: ShoppingBag,
    wrapClassName: 'bg-sky-100',
    glyphClassName: 'text-sky-600',
  },
  billing: {
    Icon: Receipt,
    wrapClassName: 'bg-amber-100',
    glyphClassName: 'text-amber-600',
  },
  document: {
    Icon: FileText,
    wrapClassName: 'bg-red-100',
    glyphClassName: 'text-red-600',
  },
  message: {
    Icon: MessageCircle,
    wrapClassName: 'bg-primary-light',
    glyphClassName: 'text-primary',
  },
  payment: {
    Icon: CheckCircle,
    wrapClassName: 'bg-green-100',
    glyphClassName: 'text-green-600',
  },
  mailroom: {
    Icon: Inbox,
    wrapClassName: 'bg-sky-100',
    glyphClassName: 'text-sky-600',
  },
};
