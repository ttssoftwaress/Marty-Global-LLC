import {
  CheckCircle,
  DollarSign,
  FileText,
  Inbox,
  MessageCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';

import type { NotificationCategory } from '../../types/notifications';

/*
 * Category → glyph + tint for a notification row's leading icon. One entry per
 * category so the icon and its soft circle match what the notification is about,
 * exactly as the desktop/tablet designs pair them:
 *   order → refresh (a status moved), billing → dollar (a quote),
 *   document → file (an action needed), message → chat (a reply),
 *   payment → check (received), mailroom → inbox (a room update).
 *
 * The tints are the design's per-category icon-wrap colours. They are soft
 * background + solid glyph pairs in the same spirit as the status badges, but
 * the palette isn't a Tailwind token, so the exact pairs live here as one map
 * rather than as hexes scattered through the JSX — change a category's colour in
 * one place. Icons themselves are pulled from lucide-react per Design guide.md,
 * never exported from Figma.
 */

type NotificationIconStyle = {
  Icon: LucideIcon;
  // Tailwind classes for the 32px circle and its glyph.
  wrapClassName: string;
  glyphClassName: string;
};

export const NOTIFICATION_ICONS: Record<
  NotificationCategory,
  NotificationIconStyle
> = {
  order: {
    Icon: RefreshCw,
    wrapClassName: 'bg-sky-100',
    glyphClassName: 'text-sky-600',
  },
  billing: {
    Icon: DollarSign,
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
