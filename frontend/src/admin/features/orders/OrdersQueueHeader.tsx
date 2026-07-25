import { Link } from 'react-router-dom';

import { formatCount } from '../../lib/format';

/*
 * The queue's page header — breadcrumb, title block, and the two stat pills.
 *
 * Desktop puts the title block and the pills on one line and prints the
 * subtitle; tablet keeps all three stacked; mobile drops the breadcrumb and the
 * subtitle, leaving the title over the pills, which is what each link shows.
 *
 * The pill copy is the desktop link's ("42 total orders", "8 awaiting review")
 * with the figures coming from the summary — nothing here is a fixed number.
 * The awaiting-review pill is hidden at zero rather than printing "0 awaiting
 * review", so the header only ever flags real work.
 */

type OrdersQueueHeaderProps = {
  totalOrders: number;
  awaitingReview: number;
};

export function OrdersQueueHeader({
  totalOrders,
  awaitingReview,
}: OrdersQueueHeaderProps) {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-4 lg:gap-6">
      <nav aria-label="Breadcrumb" className="hidden md:block">
        <ol className="flex items-center gap-2 text-caption font-medium uppercase tracking-[0.3px]">
          <li>
            <Link to="/admin" className="text-primary hover:underline">
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-400">
            /
          </li>
          <li className="text-gray-500" aria-current="page">
            Orders queue
          </li>
        </ol>
      </nav>

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[24px] font-bold leading-8 text-gray-900 md:text-h3 md:font-semibold lg:text-[32px] lg:leading-10">
            Orders queue
          </h1>
          <p className="hidden text-body text-gray-500 md:block">
            Manage and review all customer orders across services and regions.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:gap-3">
          <span className="rounded-pill bg-gray-200 px-3 py-1.5 text-small font-medium text-gray-600 md:rounded-[6px] md:bg-gray-100 md:text-[13px]">
            {formatCount(totalOrders)} total orders
          </span>

          {awaitingReview > 0 ? (
            <span className="status-review rounded-pill px-3 py-1.5 text-small font-medium md:rounded-[6px] md:text-[13px]">
              {formatCount(awaitingReview)} awaiting review
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
