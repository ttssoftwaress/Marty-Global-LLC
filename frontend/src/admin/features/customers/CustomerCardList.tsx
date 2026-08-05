import { Link } from 'react-router-dom';

import {
  ExpandChevron,
  detailPanelId,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatCount, formatMoneyCompact } from '../../lib/format';
import { formatLastActivity } from '../../lib/customers';
import type { AdminCustomerRow } from '../../types/customers';
import { CustomerAvatar } from './CustomerAvatar';
import { CustomerRowDetails } from './CustomerRowDetails';

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
 *
 * Tapping the card body opens the same panel the table's rows open — contact
 * details, headline figures, and any live suspension — fetched when opened. One
 * card is open at a time.
 */

type CustomerCardListProps = {
  customers: AdminCustomerRow[];
};

export function CustomerCardList({ customers }: CustomerCardListProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {customers.map((customer) => {
        const isExpanded = customer.id === expandedId;
        const panelId = detailPanelId('customer-card', customer.id);

        return (
          <li
            key={customer.id}
            className="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
          >
            <button
              type="button"
              onClick={() => toggle(customer.id)}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              className="flex flex-col gap-3.5 rounded-input text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex items-center gap-3">
                <CustomerAvatar
                  id={customer.id}
                  initials={customer.initials}
                  className="size-10"
                />

                <span className="flex min-w-0 flex-1 items-center gap-1.5">
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
                </span>

                <ExpandChevron isExpanded={isExpanded} />
              </span>

              <span className="flex flex-wrap items-center gap-1.5 text-small text-gray-400">
                <span>
                  {formatCount(customer.totalOrders)}{' '}
                  {customer.totalOrders === 1 ? 'order' : 'orders'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatMoneyCompact(customer.totalSpent)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatLastActivity(customer.lastActivityAt)}</span>
              </span>
            </button>

            {isExpanded ? (
              <div id={panelId} onClick={stopRowToggle}>
                <CustomerRowDetails customer={customer} />
              </div>
            ) : null}

            <Link
              to={customer.to}
              className="flex h-10 w-full items-center justify-center rounded-input border border-primary text-body font-semibold text-primary transition-colors hover:bg-primary-light"
            >
              View profile
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
