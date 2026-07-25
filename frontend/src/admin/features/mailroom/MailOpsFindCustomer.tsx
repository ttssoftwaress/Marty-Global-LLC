import { Search } from 'lucide-react';

import { MailOpsCustomerAvatar } from './MailOpsCustomerAvatar';
import type { MailOpsCustomer } from '../../types/mailroom';

/*
 * "Find customer" — the card that picks whose inbox the scan is filed into.
 *
 * The links only draw the settled state: a customer already chosen, with a
 * "Change customer" control beside them. That control implies a search state
 * the design does not cover, so this card renders both (Design.md — filling in
 * states the design skipped):
 *   - nothing chosen yet: a search field, and the matches the backend returns
 *   - chosen: the tinted selected row from the links, whose "Change customer"
 *     drops back to the search field
 *
 * Matching is server-side (AGENTS.md) — the page debounces the term into the
 * query and this card only renders what comes back, so the picker never filters
 * a client-side copy of the customer table.
 *
 * The layout of the selected row follows the desktop and tablet links: avatar,
 * "Name — email", and the change control pushed right. Mobile has no room for
 * that on one line, so — as its link shows — the identity sits in the field and
 * the change control drops beneath it.
 */

type MailOpsFindCustomerProps = {
  selected: MailOpsCustomer | null;
  search: string;
  onSearchChange: (value: string) => void;
  results: MailOpsCustomer[];
  isSearching: boolean;
  hasSearched: boolean;
  onSelect: (customer: MailOpsCustomer) => void;
  onClear: () => void;
};

export function MailOpsFindCustomer({
  selected,
  search,
  onSearchChange,
  results,
  isSearching,
  hasSearched,
  onSelect,
  onClear,
}: MailOpsFindCustomerProps) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation lg:p-card">
      <h2 className="text-h6 text-text">Find customer</h2>

      {selected ? (
        <>
          {/*
           * The settled row. Below `md` the change control moves to its own
           * line beneath the row, matching the mobile link.
           */}
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-3 md:rounded-input md:bg-primary-light md:p-3">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-input border border-gray-300 bg-gray-50 px-4 py-3 md:border-0 md:bg-transparent md:p-0">
              <MailOpsCustomerAvatar
                id={selected.id}
                initials={selected.initials}
                className="hidden size-8 md:flex"
              />
              <p className="min-w-0 flex-1 truncate text-body font-medium text-text">
                {selected.name} — {selected.email}
              </p>
            </div>

            <button
              type="button"
              onClick={onClear}
              className="self-start rounded-sm text-body font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:shrink-0 md:self-auto md:text-small"
            >
              Change customer
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-input w-full items-center gap-2 rounded-input border border-gray-300 bg-gray-50 px-4 transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)]">
            <Search
              className="size-[18px] shrink-0 text-gray-400"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name, email, or business..."
              aria-label="Search customers by name, email, or business"
              className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
            />
          </div>

          {/*
           * Results live under the field rather than in a floating popover, so
           * the card grows in the page flow instead of overlaying the form
           * beneath it — which matters most on mobile, where a popover would
           * cover the whole scan form.
           */}
          {isSearching ? (
            <p className="text-small text-gray-400">Searching…</p>
          ) : null}

          {!isSearching && hasSearched && results.length === 0 ? (
            <p className="text-small text-gray-400">
              No customers match that search.
            </p>
          ) : null}

          {results.length > 0 ? (
            <ul className="flex w-full flex-col overflow-hidden rounded-input border border-gray-200">
              {results.map((customer) => (
                <li key={customer.id} className="border-b border-gray-200 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelect(customer)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <MailOpsCustomerAvatar
                      id={customer.id}
                      initials={customer.initials}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-medium text-text">
                        {customer.name}
                      </span>
                      <span className="truncate text-small text-gray-400">
                        {customer.email}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
