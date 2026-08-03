import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, MessageCircle, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { conversationsOf, useConversation, useConversations } from './queries';
import { useConversationSocket } from './useConversationSocket';

/*
 * The floating support widget — a chat bubble on every portal screen.
 *
 * It opens the customer's most recent open conversation rather than a list: the
 * widget is for continuing a conversation without leaving what you were doing,
 * and anyone who wants to browse threads has the Support page, which the panel
 * links to.
 *
 * Bottom-RIGHT, unlike the marketing site's bottom-left bubble. The portal has a
 * fixed left sidebar at desktop widths and a bubble there would sit on top of the
 * navigation; the marketing site has no such furniture. Deliberate divergence —
 * see the design deviations note in the task summary.
 *
 * It hides itself on /app/support: a chat bubble floating over the chat screen
 * would open a second copy of the conversation already filling the page.
 */

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  /*
   * The list is already cached by the Support screen in most cases, so opening
   * the widget usually costs nothing. Only the first page is ever fetched here —
   * the widget never pages, and an unread thread is by definition one that moved
   * recently, so it is on the newest page or it is not unread.
   */
  const conversationsQuery = useConversations('');
  const conversations = conversationsOf(conversationsQuery.data);

  /*
   * "Most recent open conversation." The list arrives newest-first from the
   * backend, so this is the first entry — resolved rather than remembered,
   * because the thread the customer cares about is whichever one moved last.
   */
  const activeId = useMemo(() => conversations?.[0]?.id ?? '', [conversations]);

  const threadQuery = useConversation(open ? activeId : '');
  const chat = useConversationSocket(open ? activeId : '');

  const unread = conversations?.some((entry) => entry.unread) ?? false;

  // Close on Escape, the same as every other overlay in the portal.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (location.pathname.startsWith('/app/support')) return null;

  const send = ({ text }: { text: string; files: File[] }) => {
    if (!activeId) return;
    chat.send({ body: text });
  };

  return (
    <>
      {open ? (
        <section
          aria-label="Support chat"
          className="fixed bottom-24 right-4 z-40 flex h-[min(35rem,calc(100dvh-8rem))] w-[min(23.75rem,calc(100vw-2rem))] translate-y-0 flex-col overflow-hidden rounded-card border border-gray-200 bg-white opacity-100 shadow-lg-elevation transition-[opacity,translate] duration-200 ease-out starting:translate-y-4 starting:opacity-0 motion-reduce:transition-none md:right-6"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 p-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="truncate text-body font-semibold text-text">
                {conversations?.[0]?.subject ?? 'Support'}
              </h2>
              <p className="text-caption text-gray-500">
                {chat.agentsAvailable === null
                  ? 'Connecting…'
                  : chat.agentsAvailable > 0
                    ? 'Our team is online'
                    : "We're away — we'll email you a reply"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="flex size-8 shrink-0 items-center justify-center rounded-input text-gray-400 hover:bg-gray-100 hover:text-text"
            >
              <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </header>

          {activeId ? (
            <>
              <MessageList
                messages={threadQuery.data?.messages ?? []}
                isLoading={threadQuery.isPending}
                typing={chat.agentTyping}
              />
              <Composer onSend={send} onTyping={chat.notifyTyping} />
            </>
          ) : (
            /*
             * No conversation yet. The widget does not open one — starting a
             * thread asks for a subject and a topic, which is a form, and a form
             * belongs on the Support screen rather than in a 380px panel.
             */
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-body font-medium text-gray-600">
                No conversations yet
              </p>
              <p className="text-small text-gray-500">
                Start one and our team will pick it up.
              </p>
              <Link
                to="/app/support"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center gap-2 rounded-input bg-primary px-4 text-small font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                New conversation
              </Link>
            </div>
          )}

          {activeId ? (
            <Link
              to={`/app/support/${activeId}`}
              onClick={() => setOpen(false)}
              className="flex shrink-0 items-center justify-center gap-1.5 border-t border-gray-200 py-2.5 text-small font-medium text-primary hover:bg-gray-50"
            >
              View all conversations
              <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        aria-expanded={open}
        className="fixed bottom-6 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg-elevation transition-colors hover:bg-primary-hover hover:shadow-md-elevation md:right-6"
      >
        {open ? (
          <X className="size-6" strokeWidth={2} aria-hidden="true" />
        ) : (
          <MessageCircle className="size-6" strokeWidth={2} aria-hidden="true" />
        )}
        {/* The dot says "there is something to read" without a count — a number
            on a floating bubble competes with the top bar's own badge. */}
        {!open && unread ? (
          <span
            className="absolute right-1 top-1 size-3 animate-pop rounded-full border-2 border-white bg-accent motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
      </button>
    </>
  );
}
