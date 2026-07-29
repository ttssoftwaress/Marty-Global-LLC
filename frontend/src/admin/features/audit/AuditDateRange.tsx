import { CalendarDays } from 'lucide-react';

/*
 * The date window — two native date inputs, "From" and "To".
 *
 * Native rather than a custom calendar, and deliberately: a date picker is the
 * single most expensive control to build accessibly, the platform ships a good
 * one on every target, and nothing about picking a day here is unusual enough to
 * justify the alternative. It is also the only control on this screen a keyboard
 * user might reach for constantly.
 *
 * The values here are plain `YYYY-MM-DD` day strings, which is what the input
 * produces. Turning them into the instants the API wants happens in the page
 * (`toWindow`), because the conversion is where the viewer's timezone enters and
 * that is a decision the page owns, not this control (AGENTS.md, Dates).
 *
 * Each input caps the other's range, so an admin cannot construct the backwards
 * window the backend would refuse — the constraint is expressed where the value
 * is chosen rather than as an error after the fact.
 */

type AuditDateRangeProps = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
};

const FIELD =
  'h-input w-full min-w-0 rounded-control border border-gray-300 bg-white px-3 text-body text-text outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_1px_var(--ring-focus)]';

export function AuditDateRange({ from, to, onChange }: AuditDateRangeProps) {
  return (
    <div className="flex w-full items-center gap-2">
      <CalendarDays
        className="hidden size-4 shrink-0 text-gray-400 lg:block"
        strokeWidth={1.75}
        aria-hidden="true"
      />

      <input
        type="date"
        value={from}
        max={to || undefined}
        onChange={(event) => onChange({ from: event.target.value, to })}
        aria-label="Show entries from this date"
        className={FIELD}
      />

      <span aria-hidden="true" className="shrink-0 text-small text-gray-400">
        –
      </span>

      <input
        type="date"
        value={to}
        min={from || undefined}
        onChange={(event) => onChange({ from, to: event.target.value })}
        aria-label="Show entries up to this date"
        className={FIELD}
      />
    </div>
  );
}
