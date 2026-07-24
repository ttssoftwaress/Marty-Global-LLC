import { MessagesSquare } from 'lucide-react';

/*
 * The thread pane before a conversation is chosen. It only ever shows from
 * tablet up, where both panes are visible at once — on mobile an unselected
 * state simply shows the list. The design always depicts a thread open; this
 * fills the "nothing selected yet" state so the pane never sits blank.
 */

type EmptyThreadProps = {
  className?: string;
};

export function EmptyThread({ className = '' }: EmptyThreadProps) {
  return (
    <div
      className={`min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-card border border-gray-200 bg-white p-6 text-center ${className}`}
    >
      <span className="flex size-14 items-center justify-center rounded-[28px] bg-primary-light">
        <MessagesSquare className="size-7 text-primary" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">Select a conversation</p>
      <p className="max-w-[320px] text-body text-gray-500">
        Choose a conversation from the list to read and reply to messages with our
        team.
      </p>
    </div>
  );
}
