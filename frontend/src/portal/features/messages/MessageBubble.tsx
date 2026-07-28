import { Check, CheckCheck, Download } from 'lucide-react';

import { formatFileSize, formatMessageTime } from '../../lib/format';
import type { Message } from '../../types/messages';

/*
 * A single message. Agent messages sit left with a grey bubble and, at the
 * start of each run, the sender's avatar + name; the customer's own messages sit
 * right in a tinted bubble with no avatar. The tail corner (a squared-off 4px
 * corner) is drawn only on the first bubble of a run so a back-and-forth reads
 * as grouped turns. Any attachments render as download chips beneath the text.
 *
 * `firstOfRun` (the previous message was from someone else, or a new day began)
 * drives both the sender header and the tail.
 */

function initialOf(name: string | undefined) {
  const match = name?.trim().match(/[a-z0-9]/i);
  return match ? match[0].toUpperCase() : '?';
}

function AgentAvatar({ message }: { message: Message }) {
  if (message.senderAvatarUrl) {
    return (
      <img
        src={message.senderAvatarUrl}
        alt=""
        className="size-5 shrink-0 rounded-[10px] object-cover"
      />
    );
  }
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-primary-light text-[10px] font-semibold text-primary"
      aria-hidden="true"
    >
      {initialOf(message.senderName)}
    </span>
  );
}

function AttachmentChip({
  name,
  size,
  href,
}: {
  name: string;
  size: number;
  href?: string;
}) {
  const content = (
    <>
      <Download className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="truncate font-medium">{name}</span>
      <span className="shrink-0 text-gray-400">{formatFileSize(size)}</span>
    </>
  );
  const className =
    'flex max-w-full items-center gap-2 rounded-input border border-gray-200 bg-white px-3 py-2 text-small text-gray-700';

  return href ? (
    <a href={href} className={`${className} hover:border-gray-300`}>
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}

type MessageBubbleProps = {
  message: Message;
  firstOfRun: boolean;
};

export function MessageBubble({ message, firstOfRun }: MessageBubbleProps) {
  const isAgent = message.author === 'agent';

  return (
    <div className={`flex flex-col gap-1 ${isAgent ? 'items-start' : 'items-end'}`}>
      {isAgent && firstOfRun ? (
        <div className="flex items-center gap-2">
          <AgentAvatar message={message} />
          <span className="text-small font-medium text-gray-700">
            {message.senderName}
          </span>
        </div>
      ) : null}

      <div
        className={`flex max-w-[280px] flex-col gap-2 rounded-2xl p-3 transition-opacity md:max-w-[300px] md:px-3.5 md:py-2.5 lg:max-w-[480px] lg:px-4 lg:py-3 ${
          isAgent
            ? `bg-gray-100 ${firstOfRun ? 'rounded-tl-[4px]' : ''}`
            : `bg-primary-light ${firstOfRun ? 'rounded-tr-[4px]' : ''}`
        } ${
          // In flight: dimmed rather than replaced by a spinner, so the message
          // reads as sent-and-settling instead of as an error state.
          message.pending ? 'opacity-60' : ''
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-[14px] leading-5 text-text md:text-[13px] md:leading-[18px] lg:text-[14px] lg:leading-5">
          {message.body}
        </p>

        {message.attachments?.length ? (
          <div className="flex flex-col gap-1.5">
            {message.attachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                name={attachment.name}
                size={attachment.size}
                href={attachment.href}
              />
            ))}
          </div>
        ) : null}
      </div>

      <span className="flex items-center gap-1 text-caption text-gray-400">
        {formatMessageTime(message.sentAt)}
        {/*
         * The read receipt sits on the customer's own messages only — one tick
         * delivered, two ticks read by the team. An agent's reply carries none:
         * telling the customer they have read something is noise.
         */}
        {!isAgent && !message.pending ? (
          message.seen ? (
            <>
              <CheckCheck
                className="size-3.5 text-primary"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="sr-only">Seen by the team</span>
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
  );
}
