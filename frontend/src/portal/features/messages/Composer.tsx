import { useRef, useState } from 'react';
import { File as FileIcon, Paperclip, Send, X } from 'lucide-react';

import { formatFileSize } from '../../lib/format';

/*
 * The message composer — a text field with an attach affordance, staged
 * attachment chips, and a send control that mirrors the design's three widths
 * (icon-only on mobile, a labelled pill from tablet up). Enter sends; Shift is
 * free for future multi-line.
 *
 * Draft text and staged files live here; `onSend` hands them to the page, which
 * owns delivery. Live persistence/transport lands with the support module over
 * `services/socket.ts` (AGENTS.md, Live Chat) — until then this stays a
 * self-contained, interactive composer.
 */

const ACCEPT = '.pdf,.jpg,.jpeg,.png';

type StagedFile = { id: number; file: File };

type ComposerProps = {
  onSend: (payload: { text: string; files: File[] }) => void;
};

export function Composer({ onSend }: ComposerProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<StagedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const canSend = text.trim().length > 0 || files.length > 0;

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setFiles((prev) => [
      ...prev,
      ...Array.from(list).map((file) => ({ id: nextId.current++, file })),
    ]);
  };

  const removeFile = (id: number) =>
    setFiles((prev) => prev.filter((entry) => entry.id !== id));

  const send = () => {
    if (!canSend) return;
    onSend({ text: text.trim(), files: files.map((entry) => entry.file) });
    setText('');
    setFiles([]);
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
              <span className="max-w-[180px] truncate font-medium text-gray-700">
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
            className="flex size-[18px] shrink-0 items-center justify-center text-gray-400 hover:text-primary"
          >
            <Paperclip className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          </button>
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
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

      <p className="text-caption text-gray-400">PDF, JPG or PNG · max 10 MB</p>
    </div>
  );
}
