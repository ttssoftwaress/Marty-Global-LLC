import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/*
 * A value the customer must transfer exactly — the deposit address or the
 * amount. Both are hostile to manual typing: a mistyped TRON address sends
 * funds somewhere unrecoverable, and a mistyped amount becomes an under- or
 * overpayment a human has to resolve.
 *
 * So the value renders in a monospaced, wrapping block (never truncated with an
 * ellipsis — a partial address invites a partial copy) with copying as the
 * primary action.
 */

type CopyFieldProps = {
  label: string;
  value: string;
  /** Shown under the value — units, or a warning about exactness. */
  hint?: string;
  className?: string;
};

const RESET_MS = 2_000;

export function CopyField({ label, value, hint, className }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  // Clear the confirmation on its own, and cancel the timer if the value
  // changes or the field unmounts mid-countdown.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      /*
       * Clipboard access can be refused (insecure context, denied permission).
       * The value is selectable text either way, so the copy simply doesn't
       * confirm rather than throwing an error at the customer.
       */
      setCopied(false);
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <p className="text-caption font-semibold uppercase tracking-[0.6px] text-gray-500">
        {label}
      </p>

      <div className="flex items-stretch gap-2">
        <p className="min-w-0 flex-1 break-all rounded-input border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-[13px] leading-5 text-text">
          {value}
        </p>

        <button
          type="button"
          onClick={() => void onCopy()}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="flex w-11 shrink-0 items-center justify-center rounded-input border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary"
        >
          {copied ? (
            <Check className="size-[18px] text-success" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Copy className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Announced politely so a screen-reader user hears the copy confirmed. */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? `${label} copied to clipboard` : ''}
      </span>

      {hint ? <p className="text-small text-text-secondary">{hint}</p> : null}
    </div>
  );
}
