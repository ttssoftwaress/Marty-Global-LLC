import { useEffect, useMemo, useRef } from 'react';
import { isSameDay, parseISO } from 'date-fns';

import { formatDayLabel } from '../../lib/format';
import type { Message } from '../../types/messages';
import { MessageBubble } from './MessageBubble';

/*
 * The scrolling message area of a thread. Messages arrive oldest-first; they are
 * grouped into day sections (each led by a "Today" / date divider) and, within a
 * day, into runs so only the first bubble of a turn carries the sender and tail
 * (see MessageBubble). The area scrolls to the newest message on load and when
 * new ones arrive.
 */

type DayGroup = { key: string; label: string; day: string; messages: Message[] };

function groupByDay(messages: Message[]): DayGroup[] {
  const days: DayGroup[] = [];
  for (const message of messages) {
    const last = days[days.length - 1];
    if (last && isSameDay(parseISO(last.day), parseISO(message.sentAt))) {
      last.messages.push(message);
    } else {
      days.push({
        key: message.id,
        label: formatDayLabel(message.sentAt),
        day: message.sentAt,
        messages: [message],
      });
    }
  }
  return days;
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-gray-200" />
      <span className="shrink-0 text-small text-gray-400">{label}</span>
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

function ThreadSkeleton() {
  // Alternating agent/customer placeholder bubbles.
  const rows = [72, 0, 96, 1, 64];
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {rows.map((height, index) => (
        <div
          key={index}
          className={`flex ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}
        >
          <div
            className="w-[60%] animate-pulse rounded-2xl bg-gray-200"
            style={{ height: 48 + (height % 40) }}
          />
        </div>
      ))}
    </div>
  );
}

type MessageListProps = {
  messages: Message[];
  isLoading: boolean;
};

export function MessageList({ messages, isLoading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => groupByDay(messages), [messages]);

  // Pin to the newest message on load and whenever the count changes.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:gap-5 md:px-5 lg:px-6 lg:py-5"
    >
      {isLoading ? (
        <ThreadSkeleton />
      ) : messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-body font-medium text-gray-500">No messages yet</p>
          <p className="text-small text-gray-400">
            Send a message to start the conversation.
          </p>
        </div>
      ) : (
        days.map((day) => (
          <div key={day.key} className="flex flex-col gap-4">
            <DateDivider label={day.label} />
            {day.messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                firstOfRun={
                  index === 0 || day.messages[index - 1]?.author !== message.author
                }
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
