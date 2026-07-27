import { format, isToday, isYesterday, parseISO } from 'date-fns';

import type { SupportMessage } from '../../types/support';
import { SupportAgentAvatar } from './SupportAgentAvatar';

/*
 * One entry in the thread. Three authorships render differently, all from the
 * same chronological stream:
 *   - the reader's own message: mirrored right, brand-tinted bubble
 *   - anyone else's: avatar left, gray bubble, timestamp under it
 *   - an internal note: a full-width amber block, never sent to the customer
 *
 * The side comes from `mine` (resolved per-viewer by the backend), not from the
 * author kind, so the thread reads like a messaging app from both desks: a second
 * agent stepping in sees the assigned agent's replies on the left, as the
 * customer does. Keying this off `kind === 'staff'` would put every agent's reply
 * on the right and show a colleague's message as the reader's own. `kind` still
 * drives the "— Support" suffix, which labels the role rather than the side.
 *
 * Bubbles cap their width so a long message wraps into a column rather than
 * running the pane's full width — 580px on desktop, 280px on mobile, matching
 * the links; tablet caps at 80% since its pane is fluid.
 *
 * Timestamps in the design are bare clock times with "Yesterday" prefixed on
 * older entries. That is reproduced, extended with an explicit date once past
 * yesterday (the design's thread never scrolls back that far, but a real one
 * will) — logged as a deviation. The machine-readable instant stays in the
 * `<time>` element either way.
 */

function formatMessageTime(iso: string) {
  const date = parseISO(iso);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, h:mm a');
}

type SupportMessageRowProps = {
  message: SupportMessage;
};

export function SupportMessageRow({ message }: SupportMessageRowProps) {
  const { kind, mine, authorName, authorInitials, body, sentAt, id } = message;

  if (kind === 'internal_note') {
    return (
      <div className="flex w-full shrink-0 flex-col gap-1.5 rounded-input border border-[rgba(245,158,11,0.3)] bg-[#fef3c7] p-3.5 md:gap-1 md:p-2.5 lg:gap-1.5 lg:p-3.5">
        <p className="text-[10px] font-bold uppercase leading-normal text-[#b45309] md:font-medium lg:font-bold">
          Internal note ·{' '}
          <time dateTime={sentAt}>{formatMessageTime(sentAt)}</time>
        </p>
        <p className="whitespace-pre-wrap text-[13px] leading-[1.5] text-text md:text-small md:leading-[1.4] lg:text-[13px] lg:leading-[1.5]">
          {body}
        </p>
      </div>
    );
  }

  const isStaff = kind === 'staff';

  return (
    <div
      className={`flex w-full shrink-0 items-start gap-3 md:gap-2 lg:gap-3 ${
        mine ? 'justify-end' : ''
      }`}
    >
      {!mine ? (
        <SupportAgentAvatar
          id={id}
          initials={authorInitials}
          className="size-7 text-[10px] md:size-6 md:text-[9px] lg:size-7 lg:text-[10px]"
        />
      ) : null}

      <div
        className={`flex min-w-0 max-w-[280px] flex-1 flex-col gap-1 md:max-w-[80%] lg:max-w-[580px] ${
          mine ? 'items-end' : 'items-start'
        }`}
      >
        <p className="max-w-full truncate text-small font-medium text-gray-600 md:text-gray-700 lg:text-gray-600">
          {authorName}
          {isStaff ? (
            <span className="font-normal text-gray-400"> — Support</span>
          ) : null}
        </p>

        <div
          className={`w-full rounded-card p-3.5 md:p-2.5 lg:p-3.5 ${
            mine ? 'bg-primary-light' : 'bg-gray-100'
          }`}
        >
          <p className="whitespace-pre-wrap break-words text-body leading-[1.5] text-text md:text-[13px] md:leading-[1.4] lg:text-body lg:leading-[1.5]">
            {body}
          </p>
        </div>

        <time
          dateTime={sentAt}
          className="text-caption font-normal text-gray-400 md:text-[10px] lg:text-caption"
        >
          {formatMessageTime(sentAt)}
        </time>
      </div>

      {mine ? (
        <SupportAgentAvatar
          id={id}
          initials={authorInitials}
          className="size-7 text-[10px] md:size-6 md:text-[9px] lg:size-7 lg:text-[10px]"
        />
      ) : null}
    </div>
  );
}
