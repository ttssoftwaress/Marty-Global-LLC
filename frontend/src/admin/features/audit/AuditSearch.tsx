import { Search } from 'lucide-react';

/*
 * The audit search field. A controlled input the page debounces into the query;
 * the backend resolves the matching (AGENTS.md).
 *
 * It searches the action verb only, and the placeholder says so — searching the
 * metadata would be an unindexed scan of the largest column in the table, and an
 * admin typing a customer's name here would otherwise read an empty result as
 * "that never happened" rather than "that is not what this box searches".
 */

type AuditSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function AuditSearch({ value, onChange }: AuditSearchProps) {
  return (
    <div className="flex h-input w-full items-center gap-2 rounded-control border border-gray-300 bg-white px-4 transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)]">
      <Search
        className="size-5 shrink-0 text-gray-400 md:size-4"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by action…"
        aria-label="Search the audit log by action"
        className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
      />
    </div>
  );
}
