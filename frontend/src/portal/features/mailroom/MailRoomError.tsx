import { AlertTriangle } from 'lucide-react';

/*
 * The mail-room failure state. A fetch that errors has to say so and offer a way
 * back — leaving a skeleton up forever reads as "still loading" and gives the
 * customer nothing to act on.
 *
 * Shared by the rooms overview and a single room's inbox, which differ only in
 * what they were trying to load.
 */

type MailRoomErrorProps = {
  onRetry: () => void;
  title?: string;
  body?: string;
};

export function MailRoomError({
  onRetry,
  title = "We couldn't load your mail rooms",
  body = 'Something went wrong fetching your mail rooms. Please try again.',
}: MailRoomErrorProps) {
  return (
    <div
      role="alert"
      className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center shadow-sm-elevation"
    >
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-[var(--color-status-missing-bg)]">
        <AlertTriangle className="size-6 text-error" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">{title}</p>
      <p className="max-w-[22.5rem] text-body text-gray-500">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn btn-secondary mt-1 h-11 rounded-input px-5 text-body"
      >
        Try again
      </button>
    </div>
  );
}
