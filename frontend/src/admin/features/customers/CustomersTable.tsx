import { Link } from 'react-router-dom';
import { User } from 'lucide-react';

import { formatCount, formatMoneyCompact } from '../../lib/format';
import { formatLastActivity } from '../../lib/customers';
import type { AdminCustomerRow } from '../../types/customers';
import { CustomerAvatar } from './CustomerAvatar';

/*
 * The customers table — the desktop and tablet presentation (mobile renders
 * cards instead; see CustomerCardList).
 *
 * One real `<table>` so the columns align, the header is announced, and the
 * figures line up under their headings.
 *
 * The two links differ in how much they fit, which the same markup covers:
 *   - desktop (lg): seven columns — customer, email, region, total orders,
 *     total spent, last activity, and a labelled "View profile" button.
 *   - tablet (md):  five — the email folds under the customer's name, the last
 *     activity column drops out, and the action becomes a square icon button.
 *     `table-fixed` holds the allocation so a long name truncates instead of
 *     pushing the action off the edge; desktop switches to `table-auto` and
 *     sizes to content.
 *
 * The tablet icon button is a `user` glyph in the link, mapped to lucide's
 * `User` (Design.md, icons are read for intent) and given an accessible name so
 * the control is not silent.
 */

type CustomersTableProps = {
  customers: AdminCustomerRow[];
};

export function CustomersTable({ customers }: CustomersTableProps) {
  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[42rem] table-fixed lg:min-w-[56.25rem] lg:table-auto">
        <thead>
          <tr className="h-11 lg:h-12">
            <th scope="col" className="pl-4 pr-3 lg:pl-6 lg:pr-4">
              Customer
            </th>
            <th scope="col" className="hidden w-[15rem] pr-4 lg:table-cell">
              Email
            </th>
            <th scope="col" className="w-[6.25rem] pr-3 lg:pr-4">
              Region
            </th>
            <th
              scope="col"
              className="w-[6.25rem] pr-3 text-right lg:w-[7.5rem] lg:pr-4"
            >
              <span className="inline-block w-full text-right">
                {/* Desktop spells the two figure columns out; tablet abbreviates. */}
                <span className="lg:hidden">Orders</span>
                <span className="hidden lg:inline">Total orders</span>
              </span>
            </th>
            <th scope="col" className="w-[7.5rem] pr-3 text-right lg:pr-4">
              <span className="inline-block w-full text-right">
                <span className="lg:hidden">Spent</span>
                <span className="hidden lg:inline">Total spent</span>
              </span>
            </th>
            <th scope="col" className="hidden w-[8.75rem] pr-4 lg:table-cell">
              Last activity
            </th>
            <th
              scope="col"
              className="w-[6.25rem] pr-4 text-right lg:w-[8.125rem] lg:min-w-[8.125rem] lg:pr-6"
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {customers.map((customer) => (
            <tr
              key={customer.id}
              className="transition-colors hover:bg-gray-50"
            >
              <td className="h-16 py-3 pl-4 pr-3 lg:h-table-row lg:pl-6 lg:pr-4">
                <div className="flex items-center gap-3">
                  <CustomerAvatar
                    id={customer.id}
                    initials={customer.initials}
                    className="size-9 lg:size-8"
                  />

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className="truncate font-semibold"
                      title={customer.name}
                    >
                      {customer.name}
                    </span>
                    {/* Tablet folds the email under the name; `lg` has its own column. */}
                    <span className="truncate text-small text-gray-500 lg:hidden">
                      {customer.email}
                    </span>
                  </div>
                </div>
              </td>

              <td className="hidden py-3 pr-4 lg:table-cell">
                <a
                  href={`mailto:${customer.email}`}
                  title={customer.email}
                  className="block truncate text-gray-500 hover:text-primary hover:underline"
                >
                  {customer.email}
                </a>
              </td>

              <td className="py-3 pr-3 lg:pr-4">
                <span className="flex min-w-0 items-center gap-1.5">
                  {customer.region.flag ? (
                    <span aria-hidden="true">{customer.region.flag}</span>
                  ) : null}
                  <span className="truncate">{customer.region.name}</span>
                </span>
              </td>

              <td className="py-3 pr-3 text-right lg:pr-4">
                {formatCount(customer.totalOrders)}
              </td>

              <td className="py-3 pr-3 text-right font-semibold lg:pr-4 lg:font-medium">
                {formatMoneyCompact(customer.totalSpent)}
              </td>

              <td className="hidden py-3 pr-4 lg:table-cell">
                <span className="whitespace-nowrap text-gray-500">
                  {formatLastActivity(customer.lastActivityAt)}
                </span>
              </td>

              <td className="py-3 pl-2 pr-4 text-right lg:pr-6">
                {/* Tablet's compact icon button. */}
                <Link
                  to={customer.to}
                  aria-label={`View ${customer.name}'s profile`}
                  className="inline-flex size-[2.125rem] items-center justify-center rounded-[0.5rem] border border-primary bg-white text-primary transition-colors hover:bg-primary-light lg:hidden"
                >
                  <User
                    className="size-4"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </Link>

                {/* Desktop's labelled button. */}
                <Link
                  to={customer.to}
                  className="hidden h-9 items-center justify-center whitespace-nowrap rounded-input border border-primary bg-white px-4 text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light lg:inline-flex"
                >
                  View profile
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
