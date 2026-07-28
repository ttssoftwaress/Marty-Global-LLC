import { Search } from 'lucide-react';

/*
 * Admin top bar search — the global "find a customer, order, or ID" control.
 *
 * Two forms, one behaviour: desktop has room for the full 400px field, while
 * tablet and mobile collapse it to an icon that opens the search overlay. Both
 * report through `onSearch`/`onOpenSearch` so the page decides what searching
 * means — the bar only presents the control.
 *
 * Figma draws the desktop field as static placeholder text; it is a real
 * `<input>` here, with the form submitting on Enter, so the control actually
 * works. The tablet icon button is drawn as a bare 40px square with a 1px border
 * (the glyph inside it is a circle placeholder in the design) — it renders as a
 * search icon in a matching square, since that is plainly the intent.
 */

const SEARCH_PLACEHOLDER = 'Search customers, orders, IDs...';

export function AdminTopBarSearchField({
  onSearch,
}: {
  onSearch?: (query: string) => void;
}) {
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem('q');
        if (input instanceof HTMLInputElement) onSearch?.(input.value.trim());
      }}
      className="flex h-10 w-[25rem] shrink-0 items-center gap-2 rounded-input border border-gray-200 bg-gray-50 px-3 focus-within:border-primary"
    >
      <Search
        className="size-[1.125rem] shrink-0 text-gray-400"
        strokeWidth={1.75}
        aria-hidden="true"
      />

      <input
        type="search"
        name="q"
        aria-label={SEARCH_PLACEHOLDER}
        placeholder={SEARCH_PLACEHOLDER}
        className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
      />
    </form>
  );
}

type AdminTopBarSearchButtonProps = {
  onOpenSearch?: () => void;
  /** Mobile shows a bare 20px glyph; tablet frames it in a 40px bordered square. */
  variant: 'bare' | 'framed';
};

export function AdminTopBarSearchButton({
  onOpenSearch,
  variant,
}: AdminTopBarSearchButtonProps) {
  return (
    <button
      type="button"
      onClick={onOpenSearch}
      aria-label={SEARCH_PLACEHOLDER}
      className={
        variant === 'framed'
          ? 'flex size-10 shrink-0 items-center justify-center rounded-input border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          : 'flex size-6 shrink-0 items-center justify-center rounded-pill text-gray-700 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
      }
    >
      <Search
        className={variant === 'framed' ? 'size-[1.125rem]' : 'size-5'}
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </button>
  );
}
