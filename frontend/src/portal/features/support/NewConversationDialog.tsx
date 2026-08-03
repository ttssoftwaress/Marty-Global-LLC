import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { useOverlay } from '@/hooks/useOverlay';
import { ApiError } from '@/services/api';
import type { ConversationCategory } from '../../types/support';
import { useCreateConversation } from './queries';

/*
 * Starting a new support conversation.
 *
 * A subject, what it is about, and the first message — nothing about who answers
 * it, because the backend routes the thread to an agent as it is created.
 *
 * A dialog rather than a route: opening a conversation is a small aside from the
 * list, and sending it drops the customer straight into the new thread, so a
 * screen of its own would be a page nobody ever sees twice.
 */

const CATEGORIES: { value: ConversationCategory; label: string }[] = [
  { value: 'support', label: 'General question' },
  { value: 'formation', label: 'Company formation' },
  { value: 'billing', label: 'Billing & payments' },
  { value: 'documents', label: 'Documents' },
  { value: 'mailroom', label: 'Virtual mail' },
  { value: 'ecommerce', label: 'E-commerce' },
];

type NewConversationDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
};

export function NewConversationDialog({
  open,
  onClose,
  onCreated,
}: NewConversationDialogProps) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<ConversationCategory>('support');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const create = useCreateConversation();

  // Reset on open rather than on close, so a dialog dismissed mid-thought does
  // not visibly empty itself on the way out.
  useEffect(() => {
    if (!open) return;
    setSubject('');
    setCategory('support');
    setBody('');
    setError(null);
  }, [open]);

  // Escape, the Tab trap, focus in and back out, and the scroll lock. Focus
  // opens on the subject line — the field the design points at — rather than
  // the close button that comes first in the DOM.
  useOverlay({ open, onClose, panelRef, initialFocusRef: subjectRef });

  if (!open) return null;

  const canSubmit = subject.trim().length >= 3 && body.trim().length > 0;

  const submit = () => {
    if (!canSubmit || create.isPending) return;
    setError(null);

    create.mutate(
      { subject: subject.trim(), category, body: body.trim() },
      {
        onSuccess: (conversation) => onCreated(conversation.id),
        onError: (cause) =>
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Could not start the conversation. Please try again.',
          ),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 opacity-100 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none md:items-center md:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
        tabIndex={-1}
        className="flex max-h-full w-full max-w-[32.5rem] translate-y-0 flex-col gap-5 overflow-y-auto rounded-t-card bg-white p-5 outline-none transition-transform duration-300 ease-out starting:translate-y-8 motion-reduce:transition-none md:rounded-card md:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2
              id="new-conversation-title"
              className="text-[1.25rem] font-semibold leading-7 text-text"
            >
              New message
            </h2>
            <p className="text-small text-gray-500">
              Tell us what you need and our team will pick it up.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-input text-gray-400 hover:bg-gray-100 hover:text-text"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-small font-medium text-gray-700">Subject</span>
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={140}
            placeholder="What is this about?"
            className="h-11 rounded-input border border-gray-300 px-3 text-body text-text outline-none transition-shadow placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-small font-medium text-gray-700">Topic</span>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as ConversationCategory)
            }
            className="h-11 rounded-input border border-gray-300 bg-white px-3 text-body text-text outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)]"
          >
            {CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-small font-medium text-gray-700">Message</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={5_000}
            rows={5}
            placeholder="Give us as much detail as you can…"
            className="resize-none rounded-input border border-gray-300 p-3 text-body text-text outline-none transition-shadow placeholder:text-gray-400 focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)]"
          />
        </label>

        {error ? (
          <p role="alert" className="text-small text-error">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-input px-4 text-body font-semibold text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || create.isPending}
            className={`inline-flex h-11 items-center gap-2 rounded-input px-5 text-body font-semibold transition-colors ${
              canSubmit && !create.isPending
                ? 'bg-primary text-white hover:bg-primary-hover'
                : 'cursor-not-allowed bg-gray-200 text-gray-400'
            }`}
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : null}
            Send message
          </button>
        </div>
      </div>
    </div>
  );
}
