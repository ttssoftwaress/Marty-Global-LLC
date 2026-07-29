import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';

import { useOwnedServices } from '../../features/my-services/queries';
import { serviceIcon } from '../../features/order-new-service/serviceIcons';

/*
 * The sidebar's "My services" group — one entry per service this customer owns
 * delivered records for.
 *
 * Dynamic rather than a constant, which is the whole point: `PORTAL_NAV_ITEMS`
 * is the fixed skeleton every customer sees, and this is the part that differs
 * per customer. A customer with a company and a mail room gets two entries; one
 * with neither gets none, so the nav never offers a page with nothing on it.
 *
 * Note what is deliberately absent: the virtual mail room. It has its own
 * bespoke screens and its own fixed nav entry, so surfacing it here as well
 * would give it two links to two different pages — the generic list and the
 * inbox it actually needs.
 */

export type ServiceNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  count: number;
};

export function useServiceNavItems(): ServiceNavItem[] {
  const { data } = useOwnedServices();

  return useMemo(
    () =>
      (data ?? []).map((service) => ({
        label: service.pageTitle,
        to: `/app/services/${service.slug}`,
        icon: serviceIcon(service.iconKey),
        count: service.count,
      })),
    [data],
  );
}

/*
 * Whether a service entry is the current page. A record's detail sits at
 * `/app/services/record/:id` rather than under its service's slug — a record is
 * reached from several places and does not always know which service page the
 * customer came through — so the prefix test that works for every other nav item
 * would leave the group unhighlighted on a detail page.
 *
 * Matching the list path exactly is the honest answer: the detail page's
 * breadcrumb links back to its service, which is what actually orients the
 * customer there.
 */
export function isServiceNavItemActive(to: string, pathname: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}
