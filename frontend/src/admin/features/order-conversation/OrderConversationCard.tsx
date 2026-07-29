import { useEffect, useState } from 'react';
import { AlertCircle, Lock, MessageSquare, Send, Users } from 'lucide-react';

import { useScrollAfterItems } from '@/hooks/useScrollAfterItems';
import { ApiError } from '@/services/api';
import { DataErrorState } from '../../components/DataErrorState';
import { formatActivityTime } from '../../lib/format';
import type {
  AdminOrderConversation,
  OrderConversationMessage,
  OrderConversationReplyKind,
} from '../../types/order-conversation';
import { SectionCard } from '../order-detail/SectionCard';
import { useAdminOrderConversation, useSendAdminOrderMessage } from './queries';

/*
 * The order's conversation, staff side — the customer talking to the specialist
 * assigned to their filing.
 *
 * Not the support inbox. A support thread is routed to whichever agent is free;
 * this one belongs to this order's assignee, and the backend returns a 404 to any
 * other staff member. That is why this card can be on the order screen at all:
 * seeing it means you are the person entitled to answer it.
 *
 * Two kinds of entry share the stream and telling them apart is the point of the
 * card, exactly as in the activity feed beside it: a reply reaches the customer,
 * an internal note never does. The composer states its audience rather than
 * implying it — a required choice with no quiet default and a line that says in
 * words what pressing Send will do, because only one of the two can be taken back.
 *
 * The stream is capped at six messages and scrolls past that, the same limit the
 * activity feed uses, so neither card can push the composer off the screen.
 */

const VISIBLE_MESSAGES = 6;

const VISIBILITY: {
  value: OrderConversationReplyKind;
  label: string;
  icon: typeof Users;
  hint: string;
}[] = [
  {
    value: 'reply',
    label: 'Reply to customer',
    icon: Users,
    hint: 'The customer sees this in the conversation on their order.',
  },
  {
    value: 'note',
    label: 'Internal note',
    icon: Lock,
    hint: 'Only the team can see this. Nothing is sent to the customer.',
  },
];

/*
 * One entry in the stream.
 *
 * A reply is a bubble and sits on the side `mine` puts it on — the reader's own
 * messages right, everyone else's left, the same way the customer's screen and
 * every messaging app read. `mine` is resolved per-viewer by the backend, so it
 * means "I wrote this" rather than "my side wrote this": an admin stepping into
 * an order they do not hold sees the assignee's replies on the left, as the
 * customer sees them. The Customer/Team badge still comes from `kind`, since it
 * labels the role rather than the side.
 *
 * An internal note is deliberately not a bubble. It is not part of the
 * conversation — it is an aside the customer never receives — so it keeps the
 * full-width amber block, which is what stops it from being mistaken for
 * something that was sent.
 */
function MessageRow({
  message,
  firstOfRun,
}: {
  message: OrderConversationMessage;
  firstOfRun: boolean;
}) {
  const isNote = message.kind === 'internal_note';
  const isCustomer = message.kind === 'customer';
  const mine = message.mine;

  if (isNote) {
    return (
      <li className="flex flex-col gap-1.5 rounded-input border border-status-note-border bg-status-note-surface p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-body font-semibold text-text">
            {message.authorName}
          </p>

          <span className="flex items-center gap-1 rounded bg-status-note-bg px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase leading-none text-status-note-text">
            <Lock className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
            Internal note
          </span>

          <span className="ml-auto shrink-0 text-small text-gray-400">
            {formatActivityTime(message.sentAt)}
          </span>
        </div>

        <p className="whitespace-pre-line break-words text-body leading-relaxed text-text-secondary">
          {message.body}
        </p>
      </li>
    );
  }

  return (
    <li className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      {!mine && firstOfRun ? (
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold ${
              isCustomer ? 'bg-gray-200 text-gray-600' : 'bg-primary text-white'
            }`}
          >
            {message.authorInitials}
          </span>

          <span className="truncate text-small font-medium text-gray-700">
            {message.authorName}
          </span>

          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase leading-none ${
              isCustomer
                ? 'bg-gray-100 text-gray-500'
                : 'bg-primary-light text-primary'
            }`}
          >
            {isCustomer ? 'Customer' : 'Team'}
          </span>
        </div>
      ) : null}

      <div
        className={`flex max-w-[17.5rem] flex-col gap-2 rounded-2xl p-3 md:max-w-[22.5rem] md:px-3.5 md:py-2.5 lg:max-w-[30rem] lg:px-4 lg:py-3 ${
          mine
            ? `bg-primary-light ${firstOfRun ? 'rounded-tr-[0.25rem]' : ''}`
            : `bg-gray-100 ${firstOfRun ? 'rounded-tl-[0.25rem]' : ''}`
        }`}
      >
        <p className="whitespace-pre-line break-words text-body leading-relaxed text-text">
          {message.body}
        </p>
      </div>

      <span className="text-caption text-gray-400">
        {formatActivityTime(message.sentAt)}
      </span>
    </li>
  );
}

function Composer({ orderId }: { orderId: string }) {
  const [kind, setKind] = useState<OrderConversationReplyKind>('reply');
  const [message, setMessage] = useState('');

  const send = useSendAdminOrderMessage(orderId);

  const trimmed = message.trim();
  const selected = VISIBILITY.find((option) => option.value === kind);

  const onSend = () => {
    if (trimmed.length === 0 || send.isPending) return;
    // Cleared only once the message is stored, so a failed send never loses what
    // was typed.
    send.mutate({ body: trimmed, kind }, { onSuccess: () => setMessage('') });
  };

  const errorMessage =
    send.error instanceof ApiError
      ? send.error.message
      : send.error
        ? 'Could not send this. Try again.'
        : null;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-5">
      <div
        role="radiogroup"
        aria-label="Who can see this"
        className="flex w-full gap-1 rounded-input bg-gray-100 p-1"
      >
        {VISIBILITY.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === kind;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setKind(option.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[0.4375rem] px-3 py-2 text-small font-semibold transition-colors ${
                isActive
                  ? 'bg-white text-primary shadow-sm-elevation'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>

      <label className="sr-only" htmlFor="order-conversation-reply">
        {selected?.label}
      </label>
      <textarea
        id="order-conversation-reply"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={4}
        maxLength={5000}
        disabled={send.isPending}
        placeholder={
          kind === 'reply'
            ? 'Write a message to the customer…'
            : 'Leave a note for the team…'
        }
        className="w-full resize-y rounded-input border border-gray-300 bg-white p-3 text-body text-text outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)] disabled:bg-gray-50"
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="flex items-start gap-2 text-small text-gray-500">
          {selected ? (
            <>
              <selected.icon
                className="mt-0.5 size-3.5 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
              {selected.hint}
            </>
          ) : null}
        </p>

        <button
          type="button"
          onClick={onSend}
          disabled={trimmed.length === 0 || send.isPending}
          className="btn btn-primary h-11 shrink-0 rounded-input text-body disabled:cursor-not-allowed disabled:opacity-50 md:px-6"
        >
          <Send className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {send.isPending ? 'Sending…' : kind === 'reply' ? 'Send reply' : 'Add note'}
        </button>
      </div>

      {errorMessage ? (
        <p className="flex items-start gap-2 text-small text-error" role="alert">
          <AlertCircle
            className="mt-px size-4 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

type OrderConversationCardProps = {
  orderId: string;
};

export function OrderConversationCard({ orderId }: OrderConversationCardProps) {
  const conversationQuery = useAdminOrderConversation(orderId);
  const { data, isLoading } = conversationQuery;

  const count = data?.messages.length ?? 0;
  const { ref, maxHeight } = useScrollAfterItems<HTMLUListElement>(
    count,
    VISIBLE_MESSAGES,
  );

  // Re-pinned after the cap is measured too, so the newest message is what the
  // fold lands on rather than the oldest.
  useEffect(() => {
    const node = ref.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [count, maxHeight, ref]);

  if (isLoading) {
    return (
      <div
        className="h-[20rem] w-full animate-pulse rounded-card bg-gray-200"
        aria-hidden="true"
      />
    );
  }

  /*
   * A failed fetch used to render nothing at all, so the card simply vanished
   * from the order screen — indistinguishable from an order that has no thread.
   * The assignee has to know the difference: a customer may be waiting in it.
   */
  if (conversationQuery.isError) {
    return (
      <DataErrorState
        title="We couldn’t load this conversation"
        description="Something went wrong fetching the thread. Try again."
        onRetry={() => void conversationQuery.refetch()}
        isRetrying={conversationQuery.isFetching}
      />
    );
  }

  if (!data) return null;

  const conversation: AdminOrderConversation = data;

  return (
    <SectionCard
      title="Conversation"
      className="gap-5"
      action={
        conversation.assignee ? (
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-[0.625rem] font-semibold text-primary"
              aria-hidden="true"
            >
              {conversation.assignee.initials}
            </span>
            <span className="truncate text-small text-gray-600">
              {conversation.assignee.name}
            </span>
          </span>
        ) : (
          <span className="shrink-0 rounded bg-status-review-bg px-2 py-0.5 text-[0.625rem] font-semibold uppercase leading-none text-status-review-text">
            Unassigned
          </span>
        )
      }
    >
      <p className="text-small text-gray-500">
        {conversation.assignee
          ? 'The customer’s thread with the specialist on this order. Separate from the support inbox.'
          : 'Nobody holds this order yet. Replying here assigns it to you.'}
      </p>

      {count === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-gray-100">
            <MessageSquare
              className="size-5 text-gray-400"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </span>
          <p className="text-body font-medium text-text">No messages yet</p>
          <p className="max-w-[22.5rem] text-small text-gray-500">
            Your first reply starts the conversation with the customer.
          </p>
        </div>
      ) : (
        <ul
          ref={ref}
          style={{ maxHeight }}
          tabIndex={maxHeight === undefined ? undefined : 0}
          className="relative flex flex-col gap-4 overflow-y-auto pr-1"
        >
          {conversation.messages.map((message, index) => {
            // A run is consecutive messages from the same side; only the first
            // carries the author line and the squared-off corner. An internal
            // note breaks the run, since it is not part of the conversation.
            const previous = conversation.messages[index - 1];
            const firstOfRun =
              !previous ||
              previous.kind === 'internal_note' ||
              previous.mine !== message.mine;

            return (
              <MessageRow key={message.id} message={message} firstOfRun={firstOfRun} />
            );
          })}
        </ul>
      )}

      <Composer orderId={orderId} />
    </SectionCard>
  );
}
