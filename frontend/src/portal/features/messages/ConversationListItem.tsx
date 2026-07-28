import { Link } from 'react-router-dom';

import { formatRelativeTimeShort } from '../../lib/format';
import type { ConversationSummary } from '../../types/messages';
import { OrderStatusChip } from '../dashboard/OrderStatusChip';
import { CONVERSATION_ICONS } from './conversationIcons';

/*
 * One row in the conversation list. A single markup serves every breakpoint —
 * the container reshapes from a bordered card (mobile) to a flat divider row
 * with a left accent when selected (tablet & desktop). The icon sits to the
 * left of a two-line block: subject + status/unread on top, preview + time
 * below.
 *
 * The status chip is the app's shared order-status pill (reused so a status
 * reads identically here and in the orders list); a general support thread
 * carries no status, so it shows none. The title firms to semibold while a
 * thread is unread or open, the same emphasis the design gives it.
 */

type ConversationListItemProps = {
  conversation: ConversationSummary;
  active: boolean;
};

export function ConversationListItem({
  conversation,
  active,
}: ConversationListItemProps) {
  const Icon = CONVERSATION_ICONS[conversation.category];
  const emphasized = conversation.unread || active;

  return (
    <Link
      to={`/app/messages/${conversation.id}`}
      aria-current={active ? 'true' : undefined}
      className={`flex w-full gap-3 p-4 text-left transition-colors rounded-card border border-gray-200 bg-white md:rounded-none md:border-transparent md:border-b-gray-200 md:last:border-b-transparent ${
        active
          ? 'md:bg-primary-light md:shadow-[inset_0.1875rem_0_0_var(--color-primary)]'
          : 'hover:bg-gray-50'
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 md:size-8 lg:size-10">
        <Icon
          className="size-5 text-primary md:size-4 lg:size-5"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={`min-w-0 truncate text-[0.875rem] leading-5 text-text md:text-[0.8125rem] lg:text-[0.875rem] ${
              emphasized ? 'font-semibold' : 'font-medium'
            }`}
          >
            {conversation.subject}
          </span>

          <span className="flex shrink-0 items-center gap-1.5">
            {conversation.unread ? (
              <span
                className="size-2 shrink-0 rounded-full bg-accent"
                aria-label="Unread"
              />
            ) : null}
            {conversation.status ? (
              <OrderStatusChip status={conversation.status} />
            ) : null}
          </span>
        </span>

        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-small text-gray-500">
            {conversation.preview}
          </span>
          <span className="shrink-0 text-caption text-gray-400">
            {formatRelativeTimeShort(conversation.lastMessageAt)}
          </span>
        </span>
      </span>
    </Link>
  );
}
