import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/*
 * The trail above the customer's name.
 *
 * The links split here: desktop and tablet print the full
 * Dashboard / Customers / NAME crumb trail, while mobile drops it for a single
 * back control reading "Customers" — the same destination, at the width where a
 * three-part trail would wrap.
 *
 * The current customer is the trailing crumb and is not a link; it is marked
 * `aria-current` so the trail announces where the page sits. Its name comes from
 * the record, so the crumb is empty-safe while the query is still loading.
 */

type CustomerDetailBreadcrumbsProps = {
  customerName: string;
};

const CUSTOMERS_ROUTE = '/admin/customers';

export function CustomerDetailBreadcrumbs({
  customerName,
}: CustomerDetailBreadcrumbsProps) {
  return (
    <>
      {/* Mobile — a back control instead of the trail. */}
      <Link
        to={CUSTOMERS_ROUTE}
        className="-ml-1 flex items-center gap-2 self-start rounded-input px-1 py-1 text-body font-medium text-gray-600 transition-colors hover:text-primary md:hidden"
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Customers
      </Link>

      {/* Tablet & desktop — the full trail. */}
      <nav aria-label="Breadcrumb" className="hidden md:block">
        <ol className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.6px]">
          <li>
            <Link
              to="/admin"
              className="text-gray-400 transition-colors hover:text-primary hover:underline lg:text-gray-500"
            >
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true" className="font-normal tracking-normal text-gray-400 lg:text-gray-300">
            /
          </li>
          <li>
            <Link
              to={CUSTOMERS_ROUTE}
              className="text-gray-400 transition-colors hover:text-primary hover:underline lg:text-gray-500"
            >
              Customers
            </Link>
          </li>
          <li aria-hidden="true" className="font-normal tracking-normal text-gray-400 lg:text-gray-300">
            /
          </li>
          <li className="min-w-0 truncate text-primary" aria-current="page">
            {customerName}
          </li>
        </ol>
      </nav>
    </>
  );
}
