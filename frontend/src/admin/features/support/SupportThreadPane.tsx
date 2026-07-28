import { useEffect, useRef } from 'react';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import { Link } from 'react-router-dom';

import type {
  ComposerMode,
  SupportStatus,
  SupportThread,
} from '../../types/support';
import { SupportAssigneeMenu } from './SupportAssigneeMenu';
import { SupportComposer } from './SupportComposer';
import { SupportMessageRow } from './SupportMessageRow';
import { SupportStatusMenu } from './SupportStatusMenu';

/*
 * The right pane — the open conversation: who it is with, its messages, and the
 * composer.
 *
 * The frame is the same at every width (header, scrolling messages, pinned
 * composer); what moves is the controls. Tablet and desktop put the assignee and
 * status capsules in the header beside the customer's name, while mobile gives
 * them their own row under a compact top bar carrying the back control — so the
 * name and the two menus each get room at that width. Both are reproduced.
 *
 * The pane is a bordered white card from tablet up and fills the screen on
 * mobile, where it replaces the list rather than sitting beside it.
 *
 * The message list scrolls on its own and pins to the newest entry on open and
 * on each new message, which is what a thread that opens mid-conversation needs
 * and the static design could not show.
 */

type SupportThreadPaneProps = {
  thread: SupportThread | undefined;
  isLoading: boolean;
  onBack: () => void;
  onSend: (mode: ComposerMode, body: string) => void;
  onTyping?: (typing: boolean) => void;
  onAssign: (agentId: string | null) => void;
  onStatusChange: (status: SupportStatus) => void;
  // The customer has this conversation open right now — the agent can expect a
  // live back-and-forth rather than a reply tomorrow.
  customerOnline?: boolean;
  customerTyping?: boolean;
  className?: string;
};

/*
 * Whether the other party has this conversation open right now.
 *
 * Not "have they signed in" — presence is a fact about this instant, held in the
 * server's memory and never persisted (AGENTS.md, Live Chat). It tells the agent
 * whether to expect a live back-and-forth or to write something self-contained.
 */
function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={`size-2 shrink-0 rounded-full ${online ? 'bg-success' : 'bg-gray-300'}`}
      title={online ? 'Online now' : 'Offline'}
      role="img"
      aria-label={online ? 'Customer is online' : 'Customer is offline'}
    />
  );
}

// A thread opened from the marketing site. There is no account behind it and no
// portal to point them at — worth saying before an agent writes "check your
// dashboard".
function GuestBadge() {
  return (
    <span className="shrink-0 rounded-pill bg-gray-100 px-2 py-0.5 text-caption font-medium text-gray-600">
      Visitor
    </span>
  );
}

function ThreadSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className={`flex w-full items-start gap-3 ${index % 2 ? 'justify-end' : ''}`}
        >
          {index % 2 ? null : <div className="size-7 shrink-0 animate-pulse rounded-full bg-gray-200" />}
          <div className="flex w-full max-w-[26.25rem] flex-col gap-1">
            <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-16 w-full animate-pulse rounded-card bg-gray-200" />
          </div>
          {index % 2 ? <div className="size-7 shrink-0 animate-pulse rounded-full bg-gray-200" /> : null}
        </div>
      ))}
    </div>
  );
}

export function SupportThreadPane({
  thread,
  isLoading,
  onBack,
  onSend,
  onTyping,
  onAssign,
  onStatusChange,
  customerOnline = false,
  customerTyping = false,
  className,
}: SupportThreadPaneProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const messageCount = thread?.messages.length ?? 0;

  // The typing row adds height, so it pins too — a thread that stops following
  // the conversation the moment someone starts replying is the wrong way round.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messageCount, customerTyping]);

  /*
   * A website visitor has no customer record to link to, so the header shows the
   * email they gave when they opened the chat — which is also the only way to
   * reach them once they close the tab.
   */
  const subtitle = thread ? (
    <>
      {thread.isGuest && thread.guestEmail ? `${thread.guestEmail} · ` : null}
      {thread.subject}
      {thread.orderReference ? (
        <>
          {' · '}
          {thread.orderTo ? (
            <Link
              to={thread.orderTo}
              className="text-primary underline transition-colors hover:text-primary-hover"
            >
              {thread.orderReference}
            </Link>
          ) : (
            <span className="text-primary">{thread.orderReference}</span>
          )}
        </>
      ) : null}
    </>
  ) : null;

  return (
    <section
      aria-label="Conversation"
      className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white md:rounded-card md:border md:border-gray-200 ${
        className ?? 'flex'
      }`}
    >
      {/* Mobile — a compact top bar with the back control. */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="-ml-1 shrink-0 text-text transition-colors hover:text-primary"
          >
            <ChevronLeft className="size-5" strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="flex min-w-0 items-center gap-2 truncate text-body-lg font-semibold text-text">
              <PresenceDot online={customerOnline} />
              <span className="truncate">{thread?.customerName ?? ''}</span>
              {thread?.isGuest ? <GuestBadge /> : null}
            </p>
            <p className="truncate text-caption font-normal text-text-secondary">
              {subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Conversation options"
          className="shrink-0 text-gray-500 transition-colors hover:text-text"
        >
          <MoreVertical className="size-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* Mobile — the controls on their own row under the bar. */}
      {thread ? (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-gray-50 px-4 py-3 md:hidden">
          <SupportAssigneeMenu
            assignee={thread.assignee}
            agents={thread.assignableAgents}
            canAssign={thread.canAssign}
            onChange={onAssign}
          />
          <SupportStatusMenu
            status={thread.status}
            label={thread.statusLabel}
            onChange={onStatusChange}
          />
        </div>
      ) : null}

      {/* Tablet & desktop — name and controls share the header row. */}
      <div className="hidden shrink-0 items-center justify-between gap-4 border-b border-gray-200 p-3.5 md:flex lg:p-4">
        <div className="flex min-w-0 flex-col gap-0.5 lg:gap-1">
          <p className="flex min-w-0 items-center gap-2 text-body font-semibold text-text lg:text-body-lg lg:font-semibold">
            <PresenceDot online={customerOnline} />
            <span className="truncate">{thread?.customerName ?? ''}</span>
            {thread?.isGuest ? <GuestBadge /> : null}
          </p>
          <p className="truncate text-caption font-normal text-gray-500 lg:text-small">
            {subtitle}
          </p>
        </div>

        {thread ? (
          <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
            <SupportAssigneeMenu
              assignee={thread.assignee}
              agents={thread.assignableAgents}
              canAssign={thread.canAssign}
              onChange={onAssign}
            />
            <SupportStatusMenu
              status={thread.status}
              label={thread.statusLabel}
              onChange={onStatusChange}
            />
            <button
              type="button"
              aria-label="Conversation options"
              className="hidden size-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-text lg:flex"
            >
              <MoreVertical className="size-[1.125rem]" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      {isLoading || !thread ? (
        <ThreadSkeleton />
      ) : (
        <div
          ref={scrollerRef}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 md:gap-4 lg:gap-6 lg:p-6"
        >
          {thread.messages.map((message) => (
            <SupportMessageRow key={message.id} message={message} />
          ))}

          {customerTyping ? (
            <div
              className="flex items-center gap-2 text-small text-gray-500"
              role="status"
              aria-live="polite"
            >
              <span className="flex items-center gap-1 rounded-pill bg-gray-100 px-3 py-2">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="size-1.5 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: `${index * 150}ms`, animationDuration: '1s' }}
                    aria-hidden="true"
                  />
                ))}
              </span>
              {thread.customerFirstName} is typing…
            </div>
          ) : null}
        </div>
      )}

      {thread ? (
        <SupportComposer
          customerFirstName={thread.customerFirstName}
          onSend={onSend}
          onTyping={onTyping}
        />
      ) : null}
    </section>
  );
}
