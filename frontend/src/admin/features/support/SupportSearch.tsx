import { Search } from 'lucide-react';

/*
 * The conversation search — one field over the whole inbox, matching a customer
 * name or an order reference.
 *
 * The design draws it as a filled field on the page tint with a gray border. It
 * is a real labelled input here rather than the placeholder text the links show,
 * so it is usable by keyboard and announced to assistive tech.
 *
 * Heights follow the links: 48px on mobile, 36px on tablet, 40px on desktop.
 */

type SupportSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SupportSearch({ value, onChange }: SupportSearchProps) {
  return (
    <div className="relative w-full shrink-0">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400 md:left-2.5 md:size-3.5"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name or order ref..."
        aria-label="Search conversations by name or order reference"
        className="h-12 w-full rounded-input border border-gray-200 bg-gray-50 pl-10 pr-3.5 text-[0.8125rem] text-text outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary md:h-9 md:rounded-lg md:pl-8 md:pr-2.5 md:text-small lg:h-10 lg:rounded-input lg:pl-9 lg:text-[0.8125rem]"
      />
    </div>
  );
}
