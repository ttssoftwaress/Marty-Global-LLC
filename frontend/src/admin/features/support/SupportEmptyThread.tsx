import { MessagesSquare } from 'lucide-react';

/*
 * The right pane with nothing selected — a state the links do not draw, since
 * every frame shows a conversation already open.
 *
 * From tablet up both panes are always on screen, so landing on the inbox with
 * no conversation chosen has to render something; this fills that frame rather
 * than leaving the pane blank (logged as a deviation). Mobile never sees it —
 * there the list is the whole screen until a conversation is opened.
 */

export function SupportEmptyThread({ className }: { className?: string }) {
  return (
    <section
      aria-label="No conversation selected"
      className={`min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-card border border-gray-200 bg-white p-8 text-center ${
        className ?? 'flex'
      }`}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-gray-100">
        <MessagesSquare className="size-6 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">
        Select a conversation
      </p>
      <p className="max-w-[280px] text-small text-gray-500">
        Choose a conversation from the list to read the thread and reply.
      </p>
    </section>
  );
}
