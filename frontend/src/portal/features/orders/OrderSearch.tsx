import { Search } from 'lucide-react';

/*
 * Orders search — a real text input behind the design's search field so the
 * page is usable, not just a static pill. Desktop places it inline at the
 * right of the tabs row at a fixed 320px; tablet and mobile give it its own
 * full-width row. The Figma shows placeholder-only, so the empty state matches.
 */

type OrderSearchProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function OrderSearch({ value, onChange, className }: OrderSearchProps) {
  return (
    <div
      className={`flex h-12 items-center gap-2 rounded-input border border-gray-300 bg-white px-4 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)] ${className ?? ''}`}
    >
      <Search className="size-[18px] shrink-0 text-gray-500" strokeWidth={1.75} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search orders…"
        aria-label="Search orders"
        className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-500"
      />
    </div>
  );
}
