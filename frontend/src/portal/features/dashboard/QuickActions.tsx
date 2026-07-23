import { ChevronRight, CreditCard, Headset, PlusCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

/*
 * Quick actions — three shortcuts into the portal's most common tasks. Desktop
 * shows them as 3-across tiles (icon and chevron on one row, text beneath);
 * tablet and mobile stack them as full-width rows with the icon leading.
 *
 * The copy and destinations are fixed navigation, not customer data, so they
 * live here rather than arriving from the API.
 */

type QuickAction = {
  title: string;
  description: string;
  icon: LucideIcon;
  to: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: 'Order new service',
    description: 'Start registrations, mail rooms, and compliance setups.',
    icon: PlusCircle,
    to: '/app/order',
  },
  {
    title: 'Add payment method',
    description: 'Save a card for quotes and renewals.',
    icon: CreditCard,
    to: '/app/billing',
  },
  {
    title: 'Contact support',
    description: 'Message your dedicated client manager.',
    icon: Headset,
    to: '/app/support',
  },
];

export function QuickActions() {
  return (
    <section className="flex w-full flex-col gap-3 lg:gap-0">
      <h2 className="text-body-lg font-semibold text-text md:hidden">Quick actions</h2>

      <ul className="flex w-full flex-col gap-2 md:gap-3 lg:flex-row lg:gap-4">
        {QUICK_ACTIONS.map(({ title, description, icon: Icon, to }) => (
          <li key={to} className="w-full lg:min-w-0 lg:flex-1">
            <Link
              to={to}
              className="flex h-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-primary/30 hover:bg-primary-light/40 lg:flex-col lg:items-stretch lg:gap-4 lg:rounded-card lg:p-5"
            >
              <span className="flex items-start justify-between lg:w-full">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[20px] bg-primary-light">
                  <Icon className="size-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
                </span>

                <ChevronRight
                  className="hidden size-[18px] shrink-0 text-gray-400 lg:block"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-none lg:gap-1">
                <span className="text-body font-semibold text-text lg:text-body-lg lg:font-semibold">
                  {title}
                </span>
                <span className="text-small leading-[1.4] text-gray-500">
                  {description}
                </span>
              </span>

              <ChevronRight
                className="size-4 shrink-0 text-gray-400 lg:hidden"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
