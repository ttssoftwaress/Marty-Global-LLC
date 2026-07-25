import { Check, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatCustomerSince } from '../../lib/customer-detail';
import type { AdminCustomerDetail } from '../../types/customer-detail';
import { CustomerAvatar } from '../customers/CustomerAvatar';

/*
 * The customer's identity block — avatar, name, country chip, contact line, and
 * the Message customer action.
 *
 * The three links arrange the same parts differently, so this file draws two
 * trees rather than bending one past the point it reads:
 *   - mobile:        everything inside a white card — avatar beside a stacked
 *                    name/email/phone, the "customer since" line under it, and a
 *                    full-width solid navy button
 *   - tablet (md):   on the page background, stacked — avatar + name + chips on
 *                    one row, the contact line under it, then a left-aligned
 *                    outline button
 *   - desktop (lg):  one row — identity on the left, a solid navy button pinned
 *                    to the right
 *
 * The contact line is one sentence at `md` and up ("email · phone · Customer
 * since Jan 2026") and three lines on mobile, matching the links. Its separators
 * are decorative, so they are hidden from assistive tech and each part reads on
 * its own. A customer with no phone on file simply drops that segment rather
 * than printing an empty gap.
 *
 * The Message button is a link to the customer's conversation when the record
 * carries one, and is disabled when it does not — the control is never a dead
 * target.
 */

type CustomerDetailHeaderProps = {
  customer: AdminCustomerDetail;
};

const MESSAGE_LABEL = 'Message customer';

function StatusPill({ label }: { label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-pill bg-[var(--color-status-approved-bg)] px-2.5 py-1 text-caption font-semibold text-[#15803d]">
      <Check className="size-2.5 shrink-0" strokeWidth={3} aria-hidden="true" />
      {label}
    </span>
  );
}

function CountryChip({
  country,
  className,
}: {
  country: AdminCustomerDetail['country'];
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-[6px] bg-gray-100 px-2 py-1 ${className ?? ''}`}
    >
      {country.flag ? (
        <span aria-hidden="true" className="text-small leading-none">
          {country.flag}
        </span>
      ) : null}
      <span className="text-caption font-semibold uppercase text-gray-600">
        {country.code}
      </span>
    </span>
  );
}

export function CustomerDetailHeader({ customer }: CustomerDetailHeaderProps) {
  const since = formatCustomerSince(customer.customerSince);

  const messageButton = (className: string) =>
    customer.messageThreadTo ? (
      <Link to={customer.messageThreadTo} className={className}>
        <MessageSquare className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {MESSAGE_LABEL}
      </Link>
    ) : (
      <button type="button" disabled className={`${className} cursor-not-allowed opacity-60`}>
        <MessageSquare className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {MESSAGE_LABEL}
      </button>
    );

  return (
    <>
      {/* ---------- Mobile: the whole block inside a card ---------- */}
      <div className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:hidden">
        <div className="flex items-center gap-3">
          <CustomerAvatar
            id={customer.id}
            initials={customer.initials}
            className="size-14 text-[18px] font-semibold leading-6"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-[20px] font-semibold leading-7 text-text">
                {customer.name}
              </h1>
              <CountryChip country={customer.country} className="px-1.5 py-0.5" />
            </div>

            <p className="truncate text-small text-gray-600">{customer.email}</p>
            {customer.phone ? (
              <p className="truncate text-small text-gray-600">{customer.phone}</p>
            ) : null}
          </div>
        </div>

        {since ? <p className="text-small text-gray-400">{since}</p> : null}

        {messageButton(
          'flex h-input w-full items-center justify-center gap-2 rounded-input bg-primary text-body-lg font-semibold text-white transition-colors hover:bg-primary-hover',
        )}
      </div>

      {/* ---------- Tablet & desktop: on the page background ---------- */}
      <div className="hidden w-full flex-col gap-4 md:flex lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <CustomerAvatar
              id={customer.id}
              initials={customer.initials}
              className="size-16 text-[22px] font-semibold leading-7 lg:size-14 lg:text-[20px]"
            />

            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-3 lg:gap-2.5">
                <h1 className="truncate text-[24px] font-semibold leading-8 text-text lg:text-[32px] lg:leading-10">
                  {customer.name}
                </h1>
                <CountryChip country={customer.country} />
                {/* The Active pill is a tablet-link element; it reads as useful
                    context at every width, so desktop keeps it too. */}
                <StatusPill label={customer.statusLabel} />
              </div>

              {/* Desktop keeps the contact line tucked under the name; tablet
                  gives it the full content width on its own row below. */}
              <p className="hidden text-body text-gray-500 lg:block">
                <span>{customer.email}</span>
                {customer.phone ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span>{customer.phone}</span>
                  </>
                ) : null}
                {since ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span>{since}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <p className="text-body text-text-secondary lg:hidden">
            <span>{customer.email}</span>
            {customer.phone ? (
              <>
                <span aria-hidden="true">{'  ·  '}</span>
                <span>{customer.phone}</span>
              </>
            ) : null}
            {since ? (
              <>
                <span aria-hidden="true">{'  ·  '}</span>
                <span>{since}</span>
              </>
            ) : null}
          </p>
        </div>

        {/* Tablet's outline button sits under the contact line; desktop's solid
            one is pinned to the right of the header row. */}
        {messageButton(
          'flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-input border border-primary bg-white px-5 text-body font-semibold text-primary transition-colors hover:bg-primary-light lg:h-input lg:self-auto lg:border-transparent lg:bg-primary lg:text-white lg:hover:bg-primary-hover',
        )}
      </div>
    </>
  );
}
