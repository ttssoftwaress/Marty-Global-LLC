import { useState } from 'react';
import { ArrowUp, Paperclip } from 'lucide-react';

import type { ComposerMode } from '../../types/support';

/*
 * The composer — the reply/note mode switch, the field, and send.
 *
 * The mode switch is a real switch, not styling: a reply reaches the customer, a
 * note never does. The links draw it two ways — pills on tablet and desktop, an
 * underlined tab pair on mobile — and both are reproduced.
 *
 * Send also differs: the wider links use a labelled "Send reply" button, mobile
 * a round arrow button. Both are here, and the mobile button carries an
 * accessible label so it announces the same action.
 *
 * The field is a real auto-growing textarea rather than the single-line
 * placeholder the design draws, so a long reply is visible while it is written
 * (logged as a deviation). Enter sends and Shift+Enter breaks the line, the
 * convention for a chat composer; send is disabled while it is empty, a state
 * the design did not cover.
 *
 * Delivery is owned by the `support` module over `services/socket.ts`
 * (AGENTS.md, Live Chat) — this component owns the draft and hands the text up.
 *
 * `onTyping` fires as the agent writes, but ONLY in reply mode: an internal note
 * is not addressed to the customer, and telling them someone is typing when
 * nothing is coming their way would be a small lie the system tells itself.
 */

const MODES: { value: ComposerMode; label: string }[] = [
  { value: 'reply', label: 'Reply to customer' },
  { value: 'note', label: 'Internal note' },
];

type SupportComposerProps = {
  customerFirstName: string;
  onSend: (mode: ComposerMode, body: string) => void;
  onTyping?: (typing: boolean) => void;
};

export function SupportComposer({
  customerFirstName,
  onSend,
  onTyping,
}: SupportComposerProps) {
  const [mode, setMode] = useState<ComposerMode>('reply');
  const [draft, setDraft] = useState('');

  const canSend = draft.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(mode, draft.trim());
    setDraft('');
    onTyping?.(false);
  };

  const onType = (value: string) => {
    setDraft(value);
    onTyping?.(mode === 'reply' && value.length > 0);
  };

  const onModeChange = (next: ComposerMode) => {
    setMode(next);
    // Switching to a note stops the indicator immediately — the customer should
    // not be left watching dots for something they will never receive.
    if (next === 'note') onTyping?.(false);
  };

  const placeholder =
    mode === 'note'
      ? 'Add an internal note...'
      : `Type your reply to ${customerFirstName}...`;

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 border-t border-gray-200 bg-white p-4 md:gap-2.5 md:p-3 lg:gap-3 lg:p-4">
      {/* Mobile — an underlined tab pair. */}
      <div
        role="tablist"
        aria-label="Composer mode"
        className="flex items-start gap-2 md:hidden"
      >
        {MODES.map((item) => {
          const isActive = item.value === mode;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onModeChange(item.value)}
              className={`border-b-2 py-2 text-[0.8125rem] font-semibold transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Tablet & desktop — pills. */}
      <div
        role="tablist"
        aria-label="Composer mode"
        className="hidden items-start gap-1.5 md:flex lg:gap-2"
      >
        {MODES.map((item) => {
          const isActive = item.value === mode;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onModeChange(item.value)}
              className={`rounded-pill px-3 py-1.5 text-caption font-semibold transition-colors lg:px-3.5 lg:py-2 lg:text-small ${
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex w-full items-end gap-3 md:gap-2 lg:gap-3">
        <div
          className={`flex min-w-0 flex-1 items-end gap-2.5 rounded-card border px-3.5 py-3 transition-colors focus-within:border-primary md:gap-1.5 md:rounded-lg md:px-2.5 md:py-2 lg:gap-2.5 lg:rounded-input lg:px-3.5 lg:py-3 ${
            mode === 'note'
              ? 'border-[var(--color-status-note-border)] bg-[var(--color-status-note-surface)]'
              : 'border-gray-200 bg-white'
          }`}
        >
          <button
            type="button"
            aria-label="Attach a file"
            className="shrink-0 pb-0.5 text-gray-400 transition-colors hover:text-gray-600"
          >
            <Paperclip className="size-4 md:size-3.5 lg:size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>

          <textarea
            rows={1}
            value={draft}
            onChange={(event) => onType(event.target.value)}
            onBlur={() => onTyping?.(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            aria-label={mode === 'note' ? 'Internal note' : 'Reply to customer'}
            className="max-h-32 min-w-0 flex-1 resize-none bg-transparent text-body text-text outline-none placeholder:text-gray-400 md:text-small lg:text-body"
          />
        </div>

        {/* Mobile — a round send button. */}
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={mode === 'note' ? 'Add note' : 'Send reply'}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 md:hidden"
        >
          <ArrowUp className="size-[1.125rem]" strokeWidth={2} aria-hidden="true" />
        </button>

        {/* Tablet & desktop — the labelled button. */}
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className="hidden h-9 shrink-0 items-center rounded-lg bg-primary px-3 text-small font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 md:flex lg:h-10 lg:rounded-input lg:px-5 lg:text-body"
        >
          {mode === 'note' ? 'Add note' : 'Send reply'}
        </button>
      </div>

      <p className="text-[0.625rem] font-normal text-gray-400 lg:text-caption">
        Internal notes are never visible to the customer.
      </p>
    </div>
  );
}
