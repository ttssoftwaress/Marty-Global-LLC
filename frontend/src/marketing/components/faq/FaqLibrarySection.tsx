import { useDeferredValue, useId, useMemo, useState } from 'react';

import { ChevronDownIcon, SearchIcon, XIcon } from '../icons';
import { FAQ_CATEGORIES, type FaqCategory } from './faq-content';

/*
 * The FAQ page's body — the full question library, grouped by topic.
 *
 * Distinct from the shared `FaqSection` accordion on purpose: that one is a
 * short, closing set on home / services / how-it-works and takes its copy per
 * page. This is the whole library, so it needs the two things a long list needs
 * and a short one does not — a way to filter it, and a way to jump within it.
 *
 * Three breakpoints:
 *   - mobile (<768px):  px-4 py-12. Category chips scroll horizontally above
 *     the list; every group renders stacked below the search field.
 *   - tablet (md, 768px): px-10 py-16, roomier type; chips wrap instead of
 *     scrolling now that there is width for two rows.
 *   - desktop (lg, 1024px): px-20 py-20, a sticky category rail on the left and
 *     the groups in a 1fr column beside it, capped at 1200px total.
 *
 * Items start collapsed here — with roughly thirty questions on the page, all
 * open would bury the group headings the rail scrolls to. The shared section's
 * open-by-default behaviour is right for six questions and wrong for thirty.
 */

export function FaqLibrarySection() {
  const [query, setQuery] = useState('');
  const searchId = useId();

  // The input stays instant while the (synchronous) filter over ~30 items
  // re-runs against the settled value.
  const deferredQuery = useDeferredValue(query);
  const groups = useMemo(() => filterCategories(deferredQuery), [deferredQuery]);

  const matchCount = groups.reduce((total, group) => total + group.faqs.length, 0);
  const isSearching = deferredQuery.trim().length > 0;

  return (
    <section className="w-full bg-gray-50 px-4 py-12 md:px-10 md:py-16 lg:px-20 lg:py-20">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 lg:flex-row lg:items-start lg:gap-16">
        <CategoryRail activeIds={groups.map((group) => group.id)} />

        <div className="flex min-w-0 flex-col gap-6 lg:flex-1 lg:gap-8">
          <search className="flex flex-col gap-2">
            <label htmlFor={searchId} className="sr-only">
              Search the questions
            </label>
            <div className="relative w-full">
              <SearchIcon
                className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search questions — formation, banking, mail, payment…"
                className="h-12 w-full rounded-input border border-gray-200 bg-white pl-12 pr-12 text-[14px] text-text placeholder:text-gray-400 focus:border-primary focus:outline-none md:h-[52px] md:text-[15px]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-pill text-gray-400 transition-colors hover:bg-gray-100 hover:text-text"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
            {/*
             * Announced politely so a screen-reader user hears the list shrink
             * as they type — the visible result is otherwise silent.
             */}
            <p aria-live="polite" className="min-h-5 text-[13px] text-text-secondary">
              {isSearching
                ? `${matchCount} ${matchCount === 1 ? 'question' : 'questions'} match “${deferredQuery.trim()}”`
                : ''}
            </p>
          </search>

          {groups.length === 0 ? (
            <NoResults query={deferredQuery.trim()} onClear={() => setQuery('')} />
          ) : (
            groups.map((group) => (
              <CategoryGroup
                key={group.id}
                category={group}
                // While searching, matches open on arrival — the visitor has
                // already told us what they are looking for.
                defaultOpen={isSearching}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/*
 * The topic index. A sticky rail on desktop, a scrolling chip strip on the
 * narrower breakpoints. Each entry is a hash link, so `/faq#billing` from
 * anywhere on the site lands on the right group (PublicChrome's hash-scroll
 * effect handles the cross-page case).
 *
 * Categories filtered out by the current search are dimmed rather than removed,
 * so the index does not reflow underneath the reader mid-search.
 */
function CategoryRail({ activeIds }: { activeIds: string[] }) {
  const active = new Set(activeIds);

  return (
    <nav
      aria-label="FAQ topics"
      className="-mx-4 shrink-0 px-4 lg:sticky lg:top-8 lg:mx-0 lg:w-[260px] lg:px-0"
    >
      <h2 className="mb-3 hidden font-marketing text-[15px] font-semibold text-text lg:block">
        Browse by topic
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0 lg:flex-col lg:gap-1">
        {FAQ_CATEGORIES.map((category) => (
          <li key={category.id} className="shrink-0 lg:w-full">
            <a
              href={`#${category.id}`}
              aria-disabled={active.has(category.id) ? undefined : 'true'}
              className={`block whitespace-nowrap rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors lg:whitespace-normal lg:rounded-[10px] lg:px-3 lg:py-2.5 lg:text-[14px] ${
                active.has(category.id)
                  ? 'border-gray-200 bg-white text-text hover:border-primary hover:text-primary'
                  : 'border-transparent bg-gray-100 text-gray-400'
              }`}
            >
              {category.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function CategoryGroup({
  category,
  defaultOpen,
}: {
  category: FaqCategory;
  defaultOpen: boolean;
}) {
  return (
    <section id={category.id} className="scroll-mt-8 lg:scroll-mt-10">
      <div className="mb-3 flex flex-col gap-1 md:mb-4 md:gap-1.5">
        <h2 className="font-marketing text-[20px] font-bold leading-[1.3] text-text md:text-[24px] lg:text-[28px]">
          {category.label}
        </h2>
        <p className="text-[13px] leading-5 text-text-secondary md:text-[14px] lg:text-[15px]">
          {category.description}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 rounded-card border border-gray-200 bg-white p-3 md:gap-3 md:p-4">
        {category.faqs.map((faq) => (
          // `defaultOpen` changes when a search starts or ends, and the key
          // carries it so the items remount into the new state rather than
          // holding whatever the visitor had toggled before.
          <FaqItem
            key={`${faq.question}-${defaultOpen}`}
            question={faq.question}
            answer={faq.answer}
            defaultOpen={defaultOpen}
          />
        ))}
      </div>
    </section>
  );
}

function FaqItem({
  question,
  answer,
  defaultOpen,
}: {
  question: string;
  answer: string;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const answerId = useId();

  return (
    <div className="flex w-full flex-col items-start gap-2 rounded-[12px] bg-gray-50 p-3 md:gap-3 md:p-4">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={answerId}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0 flex-1 font-marketing text-[14px] font-semibold leading-normal text-text md:text-[15px] lg:text-[16px]">
          {question}
        </span>
        <ChevronDownIcon
          className={`size-3.5 shrink-0 text-primary transition-transform duration-200 md:size-[18px] ${
            isOpen ? '' : '-rotate-90'
          }`}
        />
      </button>
      {isOpen && (
        <p
          id={answerId}
          className="w-full text-[12px] leading-[18px] text-text-secondary md:text-[13px] md:leading-5 lg:text-[14px] lg:leading-[22px]"
        >
          {answer}
        </p>
      )}
    </div>
  );
}

/*
 * Nothing matched the search — distinct from "no questions exist", which cannot
 * happen here since the library is static. The clear action is the way out.
 */
function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-12 text-center md:py-16">
      <div className="flex size-12 items-center justify-center rounded-pill bg-gray-100 text-gray-400">
        <SearchIcon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="font-marketing text-[16px] font-semibold text-text md:text-[18px]">
        No questions match “{query}”
      </h3>
      <p className="max-w-[420px] text-[13px] leading-5 text-text-secondary md:text-[14px]">
        Try a broader word, or ask us directly — live chat and the contact form
        both reach our team.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="btn btn-secondary mt-1 h-auto rounded-input px-5 py-2.5 text-[14px]"
      >
        Clear search
      </button>
    </div>
  );
}

/*
 * Case-insensitive substring match over every word in the query — a question
 * matches when its text or its answer contains all of them, which is what makes
 * "bank account" find the banking questions without an index. Groups with no
 * remaining questions drop out entirely.
 */
function filterCategories(query: string): FaqCategory[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return FAQ_CATEGORIES;

  return FAQ_CATEGORIES.map((category) => ({
    ...category,
    faqs: category.faqs.filter((faq) => {
      const haystack = `${category.label} ${faq.question} ${faq.answer}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }),
  })).filter((category) => category.faqs.length > 0);
}
