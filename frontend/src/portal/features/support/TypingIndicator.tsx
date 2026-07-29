/*
 * The three-dot "someone is typing" row.
 *
 * Deliberately shaped like an agent's message bubble and placed where the next
 * one will appear, so the thread does not jump when the real message lands. It
 * is ephemeral — driven by a socket event, never persisted (AGENTS.md, Live
 * Chat).
 */

type TypingIndicatorProps = {
  name?: string;
  className?: string;
};

export function TypingIndicator({ name, className = '' }: TypingIndicatorProps) {
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <div
        className="flex items-center gap-1 rounded-2xl rounded-tl-[0.25rem] bg-gray-100 px-4 py-3"
        // Announced politely rather than as an alert: it updates often and must
        // never interrupt a screen reader mid-message.
        role="status"
        aria-live="polite"
        aria-label={name ? `${name} is typing` : 'Typing'}
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 animate-bounce rounded-full bg-gray-400"
            // Staggered so the three dots read as a wave rather than a pulse.
            style={{ animationDelay: `${index * 150}ms`, animationDuration: '1s' }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
