import { Link } from 'react-router-dom';

import { formatCount } from '../../lib/format';

/*
 * The page header — the crumb trail, the title and its one-liner, and the amber
 * count pill.
 *
 * The links arrange the same four parts three ways: desktop puts the pill on the
 * title's right, tablet stacks it under the description, and mobile drops both
 * the trail and the description to sit the pill beside a smaller title. All
 * three are reproduced from one tree.
 *
 * Copy follows the desktop link at every width (Design.md). The counts come from
 * the API and are inbox-wide, so the pill stays truthful as the list pages in;
 * it renders only once they have arrived rather than printing zeros while the
 * query is in flight.
 */

type SupportInboxHeaderProps = {
  totalOpen: number | undefined;
  totalUnassigned: number | undefined;
};

export function SupportInboxHeader({
  totalOpen,
  totalUnassigned,
}: SupportInboxHeaderProps) {
  const pill =
    typeof totalOpen === 'number' && typeof totalUnassigned === 'number' ? (
      <span className="shrink-0 rounded-pill bg-[#fef3c7] px-3 py-1.5 text-small font-semibold text-[#b45309] lg:px-4 lg:py-2 lg:text-body">
        {formatCount(totalOpen)} open · {formatCount(totalUnassigned)} unassigned
      </span>
    ) : null;

  return (
    <header className="flex shrink-0 flex-col gap-3 lg:gap-2">
      {/* Mobile drops the trail; tablet and desktop print it. */}
      <nav aria-label="Breadcrumb" className="hidden md:block">
        <ol className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.6px]">
          <li>
            <Link
              to="/admin"
              className="text-gray-500 transition-colors hover:text-primary hover:underline"
            >
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true" className="font-normal tracking-normal text-gray-300">
            /
          </li>
          <li className="text-primary" aria-current="page">
            Support inbox
          </li>
        </ol>
      </nav>

      {/*
       * The pill sits beside the title on mobile and desktop, and under the
       * description on tablet — so the row only holds the pill outside `md`.
       */}
      <div className="flex items-center justify-between gap-4 md:items-start">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-h4 font-bold text-text md:text-[32px] md:font-semibold md:leading-10">
            Support inbox
          </h1>
          <p className="hidden text-body font-normal text-text-secondary md:block lg:text-gray-500">
            Every customer conversation, assignable and trackable in one place.
          </p>
        </div>

        <div className="shrink-0 md:hidden lg:block">{pill}</div>
      </div>

      {/* Tablet — the pill on its own line under the description. */}
      <div className="hidden md:block lg:hidden">{pill}</div>
    </header>
  );
}
