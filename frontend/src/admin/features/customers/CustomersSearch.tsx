import { Search } from 'lucide-react';

/*
 * The customers search field. A controlled input the page debounces into the
 * query; the backend resolves the actual matching (AGENTS.md).
 *
 * Placeholder copy follows the desktop link ("Search by name, email, or
 * business...") — the tablet and mobile links word it differently, and the
 * desktop link is the copy source across the three (Design.md).
 *
 * Height tracks the links: 48px on mobile (a comfortable touch target), 40px
 * from tablet up.
 */

type CustomersSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function CustomersSearch({ value, onChange }: CustomersSearchProps) {
  return (
    <div className="flex h-12 w-full items-center gap-2 rounded-input border border-gray-300 bg-white px-3 transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)] md:h-10 md:border-gray-200 lg:border-gray-300">
      <Search
        className="size-[1.125rem] shrink-0 text-gray-400 md:size-4"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name, email, or business..."
        aria-label="Search customers by name, email, or business"
        className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
      />
    </div>
  );
}
