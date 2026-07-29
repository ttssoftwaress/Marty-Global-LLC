import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/*
 * The trail above the order reference. Mirrors the customer record's trail
 * exactly — mobile drops the three-part crumb for a single back control, tablet
 * and desktop print Dashboard / Orders / #REF — so the two detail screens behave
 * identically at every width.
 *
 * The reference is the trailing crumb and is not a link; `aria-current` marks it
 * so the trail announces where the page sits. It is empty-safe while the record
 * loads.
 */

const ORDERS_ROUTE = '/admin/orders';

export function OrderDetailBreadcrumbs({ reference }: { reference: string }) {
  return (
    <>
      {/* Mobile — a back control instead of the trail. */}
      <Link
        to={ORDERS_ROUTE}
        className="-ml-1 flex items-center gap-2 self-start rounded-input px-1 py-1 text-body font-medium text-gray-600 transition-colors hover:text-primary md:hidden"
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Orders
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
          <li
            aria-hidden="true"
            className="font-normal tracking-normal text-gray-400 lg:text-gray-300"
          >
            /
          </li>
          <li>
            <Link
              to={ORDERS_ROUTE}
              className="text-gray-400 transition-colors hover:text-primary hover:underline lg:text-gray-500"
            >
              Orders
            </Link>
          </li>
          <li
            aria-hidden="true"
            className="font-normal tracking-normal text-gray-400 lg:text-gray-300"
          >
            /
          </li>
          <li className="min-w-0 truncate text-primary" aria-current="page">
            {reference}
          </li>
        </ol>
      </nav>
    </>
  );
}
