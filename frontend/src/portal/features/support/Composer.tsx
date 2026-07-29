import { useRef, useState } from 'react';
import { File as FileIcon, Paperclip, Send, X } from 'lucide-react';

import {
  acceptAttr,
  describeTypes,
  DOCUMENT_TYPES,
  isAcceptedType,
  MAX_BYTES,
} from '@/constants/uploads';
import { formatFileSize } from '../../lib/format';

/*
 * The message composer — a text field with an attach affordance, staged
 * attachment chips, and a send control that mirrors the design's three widths
 * (icon-only on mobile, a labelled pill from tablet up). Enter sends; Shift is
 * free for future multi-line.
 *
 * Draft text and staged files live here; `onSend` hands them to the page, which
 * owns delivery over `services/socket.ts` (AGENTS.md, Live Chat).
 *
 * `onTyping` fires on each keystroke and on send. The throttling lives in the
 * socket hook, not here — this component's job is to say what happened, not to
 * decide how often the server hears about it.
 */

const ACCEPT = acceptAttr(DOCUMENT_TYPES);
const TYPE_LABEL = describeTypes(DOCUMENT_TYPES);
const MAX_ATTACHMENT_BYTES = MAX_BYTES.supportAttachment;
const MAX_MB = MAX_ATTACHMENT_BYTES / (1024 * 1024);

type StagedFile = { id: number; file: File };

type ComposerProps = {
  /*
   * May be async. The draft is cleared only once it RESOLVES — an attachment
   * upload can fail, and clearing first left the customer with no message, no
   * files, and nothing on screen to explain where they went.
   */
  onSend: (payload: { text: string; files: File[] }) => void | Promise<void>;
  onTyping?: (typing: boolean) => void;
  // Set while an attachment is still uploading, so a second send cannot race the
  // first. The field stays readable; only the controls go quiet.
  busy?: boolean;
  // A failed send, surfaced by the page that owns delivery.
  error?: string | null;
};

export function Composer({
  onSend,
  onTyping,
  busy = false,
  error = null,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [rejected, setRejected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const canSend = (text.trim().length > 0 || files.length > 0) && !busy;

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;

    // Checked here so an oversized or unsupported attachment is caught while it
    // is still on the customer's machine; the backend re-checks at presign time
    // and remains the boundary (AGENTS.md).
    const kept: File[] = [];
    const skipped: string[] = [];

    for (const file of Array.from(list)) {
      if (isAcceptedType(file, DOCUMENT_TYPES) && file.size <= MAX_ATTACHMENT_BYTES) {
        kept.push(file);
      } else {
        skipped.push(file.name);
      }
    }

    if (kept.length > 0) {
      setFiles((prev) => [
        ...prev,
        ...kept.map((file) => ({ id: nextId.current++, file })),
      ]);
    }

    setRejected(
      skipped.length > 0
        ? `Skipped ${skipped.length} file${skipped.length > 1 ? 's' : ''} — use ${TYPE_LABEL} up to ${MAX_MB} MB.`
        : null,
    );
  };

  const removeFile = (id: number) => {
    setFiles((prev) => prev.filter((entry) => entry.id !== id));
    setRejected(null);
  };

  const send = () => {
    if (!canSend) return;

    const payload = { text: text.trim(), files: files.map((entry) => entry.file) };
    setRejected(null);
    onTyping?.(false);

    /*
     * Cleared on resolve only. A rejected send keeps the draft and every staged
     * file exactly as they were, so retrying is one more click rather than
     * retyping the message and re-attaching everything — the page surfaces the
     * reason through `error`.
     */
    void Promise.resolve(onSend(payload))
      .then(() => {
        setText('');
        setFiles([]);
      })
      .catch(() => undefined);
  };

  const onType = (value: string) => {
    setText(value);
    // An emptied field is not typing — otherwise clearing a draft leaves the
    // other side watching dots that never resolve into anything.
    onTyping?.(value.length > 0);
  };

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-gray-200 p-4">
      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((entry) => (
            <span
              key={entry.id}
              className="flex items-center gap-2 rounded-pill bg-gray-100 py-1.5 pl-3 pr-2 text-small"
            >
              <FileIcon className="size-4 shrink-0 text-gray-500" strokeWidth={1.75} aria-hidden="true" />
              <span className="max-w-[11.25rem] truncate font-medium text-gray-700">
                {entry.file.name}
              </span>
              <span className="shrink-0 text-gray-400">{formatFileSize(entry.file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(entry.id)}
                aria-label={`Remove ${entry.file.name}`}
                className="flex size-4 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-text"
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-input border border-gray-300 bg-white px-3 transition-shadow focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach a file"
            className="flex size-[1.125rem] shrink-0 items-center justify-center text-gray-400 hover:text-primary"
          >
            <Paperclip className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
          </button>
          <input
            type="text"
            value={text}
            onChange={(event) => onType(event.target.value)}
            onBlur={() => onTyping?.(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Type your message…"
            aria-label="Type your message"
            className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
            className="hidden"
          />
        </div>

        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label="Send message"
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-input px-0 text-body font-semibold transition-colors md:w-auto md:px-4 ${
            canSend
              ? 'bg-primary text-white hover:bg-primary-hover'
              : 'cursor-not-allowed bg-gray-200 text-gray-400'
          }`}
        >
          <span className="hidden md:inline">Send</span>
          <Send className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {error || rejected ? (
        <p role="alert" className="text-caption text-error">
          {error ?? rejected}
        </p>
      ) : (
        <p className="text-caption text-gray-400">
          {TYPE_LABEL} · max {MAX_MB} MB
        </p>
      )}
    </div>
  );
}
