import { Link } from 'react-router-dom';

import { formatActivityTime } from '../../lib/format';
import type { SupportConversationSummary } from '../../types/support';
import { SupportAgentAvatar } from './SupportAgentAvatar';
import { SupportStatusPill } from './SupportStatusPill';

/*
 * One conversation in the list — name + time, the subject, the last message's
 * opening, and a meta row carrying the assignment and the status pill.
 *
 * The status pill is an addition to the design, which drew the state only in the
 * thread header: a queue is read by scanning it, and "which of these is still
 * waiting on us" was a question the list could not answer without opening every
 * row. Logged as a deviation; it reuses the header control's own tints so one
 * state never reads as two different things.
 *
 * The links draw the same four parts in two frames, so one tree covers both:
 *   - mobile: a standalone white card on the page tint, 16px radius, its own
 *     border, sitting in a 12px-gapped stack
 *   - tablet & desktop: a flush row inside the pane, separated by a hairline,
 *     with the selected row tinted and carrying a 3px navy left edge
 *
 * The unread dot is the design's own signal, in two hues across the links —
 * navy on mobile's first row, red on the rest. It reads as one state (unread),
 * so it renders in one hue at every width: the brand navy (logged as a
 * deviation). "Unassigned" keeps the amber the desktop link gives it rather than
 * tablet's red, since amber is the design system's `review`/attention tone and
 * red reads as an error the row is not.
 *
 * The whole row is one link to the conversation, so the hit target is the card
 * rather than the name alone.
 */

type SupportConversationItemProps = {
  conversation: SupportConversationSummary;
  isActive: boolean;
  to: string;
};

export function SupportConversationItem({
  conversation,
  isActive,
  to,
}: SupportConversationItemProps) {
  const {
    customerName,
    isGuest,
    subject,
    preview,
    lastMessageAt,
    unread,
    status,
    assignee,
  } = conversation;

  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className={`flex w-full flex-col gap-2 rounded-card border p-4 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary md:gap-1.5 md:rounded-none md:border-0 md:border-b md:border-l-3 md:p-3 lg:gap-2 lg:p-4 ${
        isActive
          ? 'border-gray-200 bg-white md:border-b-gray-200 md:border-l-primary md:bg-primary-light'
          : 'border-gray-200 bg-white hover:bg-gray-50 md:border-b-gray-200 md:border-l-transparent'
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 md:gap-1.5 lg:gap-2">
          {unread ? (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-primary md:size-1.5 lg:size-2"
            />
          ) : null}
          <p
            className={`truncate text-body md:text-[0.8125rem] lg:text-body ${
              unread ? 'font-semibold text-text' : 'font-medium text-text'
            }`}
          >
            {customerName}
          </p>
          {/* A thread from the marketing site's chat bubble. Same queue, same
              routing — but there is no account behind it, so an agent should not
              tell them to check their portal. */}
          {isGuest ? (
            <span className="shrink-0 rounded-pill bg-gray-100 px-1.5 py-0.5 text-[0.625rem] font-medium text-gray-600">
              Visitor
            </span>
          ) : null}
          {unread ? <span className="sr-only">Unread</span> : null}
        </div>

        <time
          dateTime={lastMessageAt}
          className="shrink-0 text-caption font-normal text-text-secondary md:text-gray-400"
        >
          {formatActivityTime(lastMessageAt)}
        </time>
      </div>

      <p className="w-full truncate text-[0.8125rem] font-medium text-gray-700 md:text-small md:font-semibold lg:text-small lg:text-gray-600">
        {subject}
      </p>

      {/*
       * The preview line is the one part the tablet link drops, to fit more rows
       * in a shorter pane. Desktop and mobile both keep it.
       */}
      <p className="w-full truncate text-[0.8125rem] font-normal text-text-secondary md:hidden lg:block lg:text-small lg:text-gray-500">
        {preview}
      </p>

      {/*
       * The meta row: who owns the thread on the left, what state it is in on the
       * right. The pill goes here rather than beside the name, so the row that
       * identifies the customer stays the row that identifies the customer.
       */}
      <div className="flex w-full items-center justify-between gap-2">
        {assignee ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <SupportAgentAvatar
              id={assignee.id}
              initials={assignee.initials}
              className="size-4 text-[0.5rem] md:size-3.5 md:text-[0.4375rem] lg:size-4 lg:text-[0.5rem]"
            />
            <p className="truncate text-small font-normal text-text-secondary md:text-caption md:text-gray-500 lg:font-medium">
              Assigned to {assignee.shortName}
            </p>
          </div>
        ) : (
          <p className="min-w-0 truncate text-small font-semibold text-warning md:text-caption md:text-[var(--color-status-review-text)]">
            Unassigned
          </p>
        )}

        <SupportStatusPill status={status} />
      </div>
    </Link>
  );
}
