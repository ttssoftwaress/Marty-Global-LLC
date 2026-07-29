import { useEffect, useState } from 'react';
import { AlertCircle, Lock, MessageSquare, Send } from 'lucide-react';

import { useScrollAfterItems } from '@/hooks/useScrollAfterItems';
import { ApiError } from '@/services/api';
import { formatMessageTime } from '../../lib/format';
import type { ConversationMessage, OrderConversation } from '../../types/conversation';
import { SectionCard } from '../order-detail/SectionCard';
import { useSendOrderMessage } from './queries';

/*
 * The conversation on an order — the customer talking to the specialist handling
 * their filing.
 *
 * This is not the Support screen. Support is general help, routed to
 * whichever agent is free; this thread belongs to one order and only its
 * assignee can answer it. The header says so in as many words, because a
 * customer who thinks they are talking to a 24/7 helpdesk will read a slow reply
 * as being ignored — and because it is the honest description of who is at the
 * other end.
 *
 * When the order has no assignee yet the composer is replaced by an explanation
 * rather than being silently disabled. The reason comes from the backend, which
 * is also what refuses the send, so the two can never drift apart.
 *
 * The thread is capped at six messages and scrolls past that, the same limit the
 * activity feed above uses, so neither card can push the composer off the screen.
 */

const VISIBLE_MESSAGES = 6;

function Avatar({ message }: { message: ConversationMessage }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-[0.625rem] bg-primary-light text-[0.625rem] font-semibold text-primary"
      aria-hidden="true"
    >
      {message.authorInitials}
    </span>
  );
}

function MessageRow({
  message,
  firstOfRun,
}: {
  message: ConversationMessage;
  firstOfRun: boolean;
}) {
  const mine = message.mine;

  return (
    <div className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      {!mine && firstOfRun ? (
        <div className="flex items-center gap-2">
          <Avatar message={message} />
          <span className="text-small font-medium text-gray-700">
            {message.authorName}
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
        <p className="whitespace-pre-wrap break-words text-[0.875rem] leading-5 text-text">
          {message.body}
        </p>
      </div>

      <span className="text-caption text-gray-400">
        {formatMessageTime(message.sentAt)}
      </span>
    </div>
  );
}

function EmptyThread({ assigneeName }: { assigneeName: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-gray-100">
        <MessageSquare
          className="size-5 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <p className="text-body font-medium text-text">No messages yet</p>
      <p className="max-w-[20rem] text-small text-gray-500">
        {assigneeName
          ? `Ask ${assigneeName} anything about this order — they are handling your filing.`
          : 'Once a specialist is assigned to this order, you can talk to them here.'}
      </p>
    </div>
  );
}

function Composer({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState('');
  const send = useSendOrderMessage(orderId);

  const trimmed = message.trim();

  const onSend = () => {
    if (trimmed.length === 0 || send.isPending) return;
    // Cleared only once the message is stored, so a failed send never loses what
    // was typed.
    send.mutate(trimmed, { onSuccess: () => setMessage('') });
  };

  const errorMessage =
    send.error instanceof ApiError
      ? send.error.message
      : send.error
        ? 'Could not send this. Try again.'
        : null;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-5">
      <label className="sr-only" htmlFor="order-conversation-message">
        Write a message
      </label>
      <textarea
        id="order-conversation-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter breaks the line — the convention every chat
          // surface in the app follows.
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        rows={3}
        maxLength={5000}
        disabled={send.isPending}
        placeholder="Write a message about this order…"
        className="w-full resize-y rounded-input border border-gray-300 bg-white p-3 text-body text-text outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)] disabled:bg-gray-50"
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-small text-gray-500">
          Replies come from the specialist on this order.
        </p>
        <button
          type="button"
          onClick={onSend}
          disabled={trimmed.length === 0 || send.isPending}
          className="btn btn-primary h-11 shrink-0 rounded-input text-body disabled:cursor-not-allowed disabled:opacity-50 md:px-6"
        >
          <Send className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {send.isPending ? 'Sending…' : 'Send'}
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

// The read-only state. An explanation rather than a disabled box, because the
// customer has done nothing wrong and the wait is ours to account for.
function LockedNotice({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-3 rounded-input border border-gray-200 bg-gray-50 p-4">
      <Lock
        className="mt-0.5 size-4 shrink-0 text-gray-400"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <p className="text-small leading-relaxed text-gray-600">{reason}</p>
    </div>
  );
}

type ConversationCardProps = {
  conversation: OrderConversation;
};

export function ConversationCard({ conversation }: ConversationCardProps) {
  const count = conversation.messages.length;
  const { ref, maxHeight } = useScrollAfterItems<HTMLDivElement>(
    count,
    VISIBLE_MESSAGES,
  );

  // Keep the newest message in view as the thread grows, the way a chat should
  // behave — without yanking the whole page, which is why it scrolls the pane.
  // Re-pinned once the cap is measured, so the fold lands on the newest message
  // rather than the oldest.
  useEffect(() => {
    const node = ref.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [count, maxHeight, ref]);

  const assigneeName = conversation.assignee?.name ?? null;

  return (
    <SectionCard
      title="Conversation"
      className="gap-5 md:gap-6"
      titleAccessory={
        assigneeName ? (
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-[0.625rem] font-semibold text-primary"
              aria-hidden="true"
            >
              {conversation.assignee?.initials}
            </span>
            <span className="truncate text-small text-gray-600">{assigneeName}</span>
          </span>
        ) : (
          <span className="shrink-0 text-small text-gray-400">Unassigned</span>
        )
      }
    >
      <p className="text-small text-gray-500">
        Messages about this order, with the specialist handling it. For anything
        else, use{' '}
        <span className="font-medium text-gray-600">Support</span>.
      </p>

      {count === 0 ? (
        <EmptyThread assigneeName={assigneeName} />
      ) : (
        <div
          ref={ref}
          style={{ maxHeight }}
          tabIndex={maxHeight === undefined ? undefined : 0}
          className="relative flex flex-col gap-3 overflow-y-auto pr-1"
        >
          {conversation.messages.map((message, index) => {
            const previous = conversation.messages[index - 1];
            const firstOfRun = !previous || previous.mine !== message.mine;
            return (
              <MessageRow
                key={message.id}
                message={message}
                firstOfRun={firstOfRun}
              />
            );
          })}
        </div>
      )}

      {conversation.canReply ? (
        <Composer orderId={conversation.orderId} />
      ) : (
        <LockedNotice
          reason={
            conversation.lockedReason ??
            'You cannot reply to this conversation right now.'
          }
        />
      )}
    </SectionCard>
  );
}
