import { MessagesSquare, UserMinus } from 'lucide-react';

/*
 * The right pane with no readable conversation — two states the links do not
 * draw, since every frame shows a conversation already open.
 *
 * From tablet up both panes are always on screen, so landing on the inbox with
 * no conversation chosen has to render something; this fills that frame rather
 * than leaving the pane blank (logged as a deviation). Mobile never sees the
 * empty variant — there the list is the whole screen until one is opened.
 *
 * `unavailable` is the other half: a thread an admin has just moved to another
 * agent stops being readable while it is open on this desk. Saying so is the
 * honest answer — the alternative is a pane that sits on a skeleton forever
 * because its refetch 404s.
 */

type SupportEmptyThreadProps = {
  variant?: 'empty' | 'unavailable';
  className?: string;
};

const COPY = {
  empty: {
    label: 'No conversation selected',
    title: 'Select a conversation',
    detail: 'Choose a conversation from the list to read the thread and reply.',
  },
  unavailable: {
    label: 'Conversation unavailable',
    title: 'This conversation moved',
    detail:
      'It has been assigned to another team member, so it is no longer in your inbox.',
  },
} as const;

export function SupportEmptyThread({
  variant = 'empty',
  className,
}: SupportEmptyThreadProps) {
  const copy = COPY[variant];
  const Icon = variant === 'unavailable' ? UserMinus : MessagesSquare;

  return (
    <section
      aria-label={copy.label}
      className={`min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-card border border-gray-200 bg-white p-8 text-center ${
        className ?? 'flex'
      }`}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-gray-100">
        <Icon className="size-6 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">{copy.title}</p>
      <p className="max-w-[17.5rem] text-small text-gray-500">{copy.detail}</p>
    </section>
  );
}
