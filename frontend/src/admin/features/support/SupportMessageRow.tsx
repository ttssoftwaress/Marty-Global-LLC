import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Check, CheckCheck, Download } from 'lucide-react';

import { formatFileSize } from '../../lib/format';
import type {
  SupportMessage,
  SupportMessageAttachment,
} from '../../types/support';
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

/*
 * A file the customer sent with the message.
 *
 * The chip is the link — a presigned URL is a short-TTL bearer token minted by
 * the read that returned this message, so it is followed rather than stored, and
 * a chip with no `href` renders as a plain name instead of a dead link (the
 * bucket may simply not be configured in this environment).
 *
 * Not in the Figma context, which never shows an attachment — added because the
 * customer can attach files to a support message and the agent answering had no
 * way to open them. Logged as a deviation.
 */
function AttachmentChip({ attachment }: { attachment: SupportMessageAttachment }) {
  const content = (
    <>
      <Download className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 truncate font-medium">{attachment.name}</span>
      <span className="shrink-0 text-gray-400">{formatFileSize(attachment.size)}</span>
    </>
  );

  const className =
    'flex max-w-full items-center gap-2 rounded-input border border-gray-200 bg-white px-3 py-2 text-small text-gray-700';

  return attachment.href ? (
    <a
      href={attachment.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} transition-colors hover:border-gray-300 hover:bg-gray-50`}
    >
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}

type SupportMessageRowProps = {
  message: SupportMessage;
};

export function SupportMessageRow({ message }: SupportMessageRowProps) {
  const {
    kind,
    mine,
    authorName,
    authorInitials,
    body,
    sentAt,
    id,
    seen,
    pending,
    attachments,
  } = message;

  if (kind === 'internal_note') {
    return (
      <div className="flex w-full shrink-0 flex-col gap-1.5 rounded-input border border-[var(--color-status-note-border)] bg-[var(--color-status-note-bg)] p-3.5 md:gap-1 md:p-2.5 lg:gap-1.5 lg:p-3.5">
        <p className="text-[0.625rem] font-bold uppercase leading-normal text-[var(--color-status-note-text)] md:font-medium lg:font-bold">
          Internal note ·{' '}
          <time dateTime={sentAt}>{formatMessageTime(sentAt)}</time>
        </p>
        <p className="whitespace-pre-wrap text-[0.8125rem] leading-[1.5] text-text md:text-small md:leading-[1.4] lg:text-[0.8125rem] lg:leading-[1.5]">
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
          className="size-7 text-[0.625rem] md:size-6 md:text-[0.5625rem] lg:size-7 lg:text-[0.625rem]"
        />
      ) : null}

      <div
        className={`flex min-w-0 max-w-[17.5rem] flex-1 flex-col gap-1 md:max-w-[80%] lg:max-w-[36.25rem] ${
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
          className={`flex w-full flex-col gap-2 rounded-card p-3.5 transition-opacity md:p-2.5 lg:p-3.5 ${
            mine ? 'bg-primary-light' : 'bg-gray-100'
          } ${pending ? 'opacity-60' : ''}`}
        >
          {body ? (
            <p className="whitespace-pre-wrap break-words text-body leading-[1.5] text-text md:text-[0.8125rem] md:leading-[1.4] lg:text-body lg:leading-[1.5]">
              {body}
            </p>
          ) : null}

          {attachments?.length ? (
            <div className="flex flex-col gap-1.5">
              {attachments.map((attachment) => (
                <AttachmentChip key={attachment.id} attachment={attachment} />
              ))}
            </div>
          ) : null}
        </div>

        <span className="flex items-center gap-1 text-caption font-normal text-gray-400 md:text-[0.625rem] lg:text-caption">
          <time dateTime={sentAt}>{formatMessageTime(sentAt)}</time>
          {/* The read receipt sits on staff replies only — one tick delivered,
              two ticks read by the customer. */}
          {isStaff && !pending ? (
            seen ? (
              <>
                <CheckCheck className="size-3.5 text-primary" strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">Seen by the customer</span>
              </>
            ) : (
              <>
                <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">Sent</span>
              </>
            )
          ) : null}
        </span>
      </div>

      {mine ? (
        <SupportAgentAvatar
          id={id}
          initials={authorInitials}
          className="size-7 text-[0.625rem] md:size-6 md:text-[0.5625rem] lg:size-7 lg:text-[0.625rem]"
        />
      ) : null}
    </div>
  );
}
