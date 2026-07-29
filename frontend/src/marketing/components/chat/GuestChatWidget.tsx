import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';

import { ApiError } from '@/services/api';
import { Turnstile } from './Turnstile';
import { useGuestThread, useStartGuestChat } from './queries';
import { useGuestChatSocket } from './useGuestChatSocket';

/*
 * The marketing site's chat bubble — live support for a visitor with no account.
 *
 * Bottom-LEFT, as specified, unlike the portal's bottom-right widget: the
 * marketing pages have no left-hand furniture to collide with, and the two
 * surfaces are never on screen together.
 *
 * A visitor gives a name and an email before the first message. The email is not
 * a formality — it is the only way to reach them once they close the tab, and it
 * is what the offline handoff sends to when nobody answers within a few minutes.
 *
 * Their conversation is remembered for 7 days by a token in localStorage, so
 * someone who returns days later picks up the same thread rather than starting
 * over. After that it is deleted outright, server-side.
 */

// Matches GUEST_CHAT_RETENTION_DAYS on the backend. Printed rather than fetched
// because it is a promise the copy makes, not a runtime value.
const RETENTION_DAYS = 7;

function Bubbles({ label }: { label: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded-2xl rounded-tl-[4px] bg-gray-100 px-3.5 py-2.5"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: `${index * 150}ms`, animationDuration: '1s' }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function StartForm({ onStarted }: { onStarted: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  const start = useStartGuestChat();
  const canSubmit =
    name.trim().length > 0 && email.trim().length > 3 && body.trim().length > 0;

  const submit = () => {
    if (!canSubmit || start.isPending) return;
    setError(null);

    start.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        body: body.trim(),
        turnstileToken,
      },
      {
        onSuccess: onStarted,
        onError: (cause) =>
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Could not start the chat. Please try again.',
          ),
      },
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="text-small text-gray-600">
        Tell us who you are and we&rsquo;ll reply right here. If we&rsquo;re away,
        we&rsquo;ll email you.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-caption font-medium text-gray-700">Your name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          autoComplete="name"
          className="h-10 rounded-input border border-gray-300 px-3 text-small text-text outline-none transition-shadow placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-caption font-medium text-gray-700">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={200}
          autoComplete="email"
          className="h-10 rounded-input border border-gray-300 px-3 text-small text-text outline-none transition-shadow placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-caption font-medium text-gray-700">How can we help?</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2_000}
          rows={4}
          className="resize-none rounded-input border border-gray-300 p-3 text-small text-text outline-none transition-shadow placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)]"
        />
      </label>

      <Turnstile onToken={setTurnstileToken} />

      {error ? (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit || start.isPending}
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-input text-small font-semibold transition-colors ${
          canSubmit && !start.isPending
            ? 'bg-primary text-white hover:bg-primary-hover'
            : 'cursor-not-allowed bg-gray-200 text-gray-400'
        }`}
      >
        {start.isPending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : null}
        Start chat
      </button>

      <p className="text-caption text-gray-400">
        We keep this conversation for {RETENTION_DAYS} days, then delete it. See
        our{' '}
        <Link
          to="/legal/privacy"
          className="underline underline-offset-2 transition-colors hover:text-gray-600"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

export function GuestChatWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);

  const threadQuery = useGuestThread(open);
  const thread = threadQuery.data ?? null;
  const chat = useGuestChatSocket(Boolean(thread));

  const messageCount = thread?.messages.length ?? 0;

  useEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messageCount, chat.agentTyping, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    chat.send(body);
    setDraft('');
  };

  const status =
    chat.agentsAvailable === null
      ? 'Typically replies within a few minutes'
      : chat.agentsAvailable > 0
        ? "We're online now"
        : "We're away — we'll email you a reply";

  return (
    <>
      {open ? (
        <section
          aria-label="Chat with Marty Global"
          className="fixed bottom-24 left-4 z-40 flex h-[min(560px,calc(100dvh-8rem))] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-card border border-gray-200 bg-white shadow-lg-elevation md:left-6"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 bg-primary p-4 text-white">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-body font-semibold">Chat with us</h2>
              <p className="text-caption text-white/80">{status}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="flex size-8 shrink-0 items-center justify-center rounded-input text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </header>

          {threadQuery.isPending && threadQuery.fetchStatus !== 'idle' ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2
                className="size-5 animate-spin text-gray-400"
                strokeWidth={2}
                aria-hidden="true"
              />
            </div>
          ) : !thread ? (
            <StartForm onStarted={() => setDraft('')} />
          ) : (
            <>
              <div
                ref={scrollerRef}
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
              >
                {thread.messages.map((message) => {
                  const fromAgent = message.author === 'agent';
                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col gap-1 ${
                        fromAgent ? 'items-start' : 'items-end'
                      }`}
                    >
                      {fromAgent && message.senderName ? (
                        <span className="text-caption font-medium text-gray-500">
                          {message.senderName}
                        </span>
                      ) : null}
                      <p
                        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-small leading-5 transition-opacity ${
                          fromAgent
                            ? 'rounded-tl-[4px] bg-gray-100 text-text'
                            : 'rounded-tr-[4px] bg-primary-light text-text'
                        } ${message.pending ? 'opacity-60' : ''}`}
                      >
                        {message.body}
                      </p>
                    </div>
                  );
                })}

                {chat.agentTyping ? <Bubbles label="Marty Global is typing" /> : null}
              </div>

              <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 p-3">
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    chat.notifyTyping(event.target.value.length > 0);
                  }}
                  onBlur={() => chat.notifyTyping(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Type your message…"
                  aria-label="Type your message"
                  maxLength={2_000}
                  className="h-10 min-w-0 flex-1 rounded-input border border-gray-300 px-3 text-small text-text outline-none transition-shadow placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)]"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={draft.trim().length === 0}
                  aria-label="Send message"
                  className="flex size-10 shrink-0 items-center justify-center rounded-input bg-primary text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                  <Send className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close chat' : 'Chat with us'}
        aria-expanded={open}
        className="fixed bottom-6 left-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg-elevation transition-colors hover:bg-primary-hover md:left-6"
      >
        {open ? (
          <X className="size-6" strokeWidth={2} aria-hidden="true" />
        ) : (
          <MessageCircle className="size-6" strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
