import { Link } from 'react-router-dom';

import { formatCount, formatMoneyCompact } from '../../lib/format';
import { formatLastActivity } from '../../lib/customers';
import type { AdminCustomerRow } from '../../types/customers';
import { CustomerAvatar } from './CustomerAvatar';

/*
 * The mobile presentation of the list — one card per customer, replacing the
 * table below `md`. Each card follows its link: the initials avatar with the
 * name and region flag on the top row, the email under it, then a meta line of
 * orders · spent · last activity, and a full-width "View profile" button.
 *
 * The meta line's separators are decorative, so they are hidden from assistive
 * tech and each figure keeps a word with it — a screen reader reads "12 orders,
 * $28,400, 2 hours ago" rather than three bare values.
 *
 * The whole card is not a link: the button is the row's single primary target,
 * which keeps the card's text selectable and the email tappable on its own.
 */

type CustomerCardListProps = {
  customers: AdminCustomerRow[];
};

export function CustomerCardList({ customers }: CustomerCardListProps) {
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {customers.map((customer) => (
        <li
          key={customer.id}
          className="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
        >
          <div className="flex items-center gap-3">
            <CustomerAvatar
              id={customer.id}
              initials={customer.initials}
              className="size-10"
            />

            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-body font-semibold text-text">
                {customer.name}
              </span>
              {customer.region.flag ? (
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[0.9375rem] leading-none"
                >
                  {customer.region.flag}
                </span>
              ) : null}
            </div>
          </div>

          <a
            href={`mailto:${customer.email}`}
            className="truncate text-small text-text-secondary hover:text-primary hover:underline"
          >
            {customer.email}
          </a>

          <p className="flex flex-wrap items-center gap-1.5 text-small text-gray-400">
            <span>
              {formatCount(customer.totalOrders)}{' '}
              {customer.totalOrders === 1 ? 'order' : 'orders'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatMoneyCompact(customer.totalSpent)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatLastActivity(customer.lastActivityAt)}</span>
          </p>

          <Link
            to={customer.to}
            className="flex h-10 w-full items-center justify-center rounded-input border border-primary text-body font-semibold text-primary transition-colors hover:bg-primary-light"
          >
            View profile
          </Link>
        </li>
      ))}
    </ul>
  );
}
