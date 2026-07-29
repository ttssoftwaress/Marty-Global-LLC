import { Link } from 'react-router-dom';

import { formatCount } from '../../lib/format';
import type { CustomersScope } from '../../types/customers';

/*
 * The customers screen's page header — breadcrumb, title block, and the total
 * pill.
 *
 * The three links arrange the same three parts differently, which one tree
 * covers: desktop puts the title block and the pill on one line; tablet stacks
 * title, subtitle, then pill; mobile drops the breadcrumb and sets the pill
 * beside the title with the subtitle underneath.
 *
 * The pill copy is the desktop link's ("128 total customers") with the figure
 * coming from the summary — nothing here is a fixed number. Mobile's link
 * shortens it to "128 total", but the desktop link is the copy source across the
 * three (Design.md), so the full wording is what renders at every width.
 *
 * No total, no pill: while the summary is loading or after it failed there is no
 * figure to print, and defaulting to zero would state "0 total customers" as
 * though it were the answer.
 *
 * Both the pill and the subtitle follow the viewer's scope, which the backend
 * resolves alongside the count. A member who only sees the customers they deal
 * with gets the same figure said differently — "128 total customers" would
 * present their book as the whole business's.
 */

type CustomersHeaderProps = {
  totalCustomers: number | undefined;
  scope: CustomersScope | undefined;
};

export function CustomersHeader({ totalCustomers, scope }: CustomersHeaderProps) {
  const assigned = scope === 'assigned';

  const pill = totalCustomers === undefined ? null : (
    <span className="shrink-0 rounded-pill bg-gray-100 px-3 py-1.5 text-small font-medium text-text-secondary lg:px-4 lg:py-2 lg:text-gray-600">
      {assigned
        ? `${formatCount(totalCustomers)} customers assigned to you`
        : `${formatCount(totalCustomers)} total customers`}
    </span>
  );

  return (
    <div className="flex w-full flex-col gap-3 md:gap-6">
      <nav aria-label="Breadcrumb" className="hidden md:block">
        <ol className="flex items-center gap-1.5 text-caption font-medium uppercase tracking-[0.6px] lg:gap-2">
          <li>
            <Link to="/admin" className="text-gray-500 hover:text-primary hover:underline">
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true" className="tracking-normal text-gray-400">
            /
          </li>
          <li className="text-gray-500" aria-current="page">
            Customers
          </li>
        </ol>
      </nav>

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          {/* Mobile sets the pill beside the title; from `md` the title owns the
              row and the pill moves below (tablet) or to the far right of the
              header (desktop). */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[2rem] font-semibold leading-10 text-text md:font-bold lg:font-semibold">
              Customers
            </h1>
            <span className="md:hidden">{pill}</span>
          </div>

          <p className="text-body text-text-secondary">
            {assigned
              ? 'View and manage the customer accounts assigned to you.'
              : 'View and manage every customer account.'}
          </p>
        </div>

        <div className="hidden md:block">{pill}</div>
      </div>
    </div>
  );
}
