import { Search } from 'lucide-react';

/*
 * The team search field. A controlled input the page debounces into the query;
 * the backend resolves the actual matching (AGENTS.md).
 *
 * 48px tall at every width, matching all three links and the design system's
 * input height. The mobile link omits the magnifier glyph; it is kept there too
 * so the control reads as a search field on a phone (Design.md, logged as a
 * deviation).
 */

type TeamSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function TeamSearch({ value, onChange }: TeamSearchProps) {
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
        placeholder="Search by name or email..."
        aria-label="Search team members by name or email"
        className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
      />
    </div>
  );
}
