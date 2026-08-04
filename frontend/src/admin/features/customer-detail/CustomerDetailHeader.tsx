import { Ban, Check, Clock, MessageSquare, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatCustomerSince } from '../../lib/customer-detail';
import type {
  AdminCustomerDetail,
  CustomerAccountStatus,
} from '../../types/customer-detail';
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
 *
 * Beside it sits the account's suspension control, for the members who hold
 * `customers.ban` — the backend answers that on the record itself (`canBan`), so
 * the button is absent rather than dead for everyone else. A suspended account
 * shows the reason under the identity line: whoever opens the record next is the
 * whole audience for that note, and it is the first thing they need.
 */

type CustomerDetailHeaderProps = {
  customer: AdminCustomerDetail;
  onSuspend: () => void;
  onRestore: () => void;
};

const MESSAGE_LABEL = 'Message customer';

/*
 * The pill reads the status rather than always printing Active with a tick. It
 * had been hardcoded green, which is the one state it must never claim wrongly:
 * a suspended account rendering as Active is a member reading a closed account
 * as open, right where they would go to check.
 */
const STATUS_STYLES: Record<
  CustomerAccountStatus,
  { className: string; icon: LucideIcon }
> = {
  active: {
    className:
      'bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]',
    icon: Check,
  },
  inactive: {
    className:
      'bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]',
    icon: Clock,
  },
  suspended: {
    className:
      'bg-[var(--color-status-missing-bg)] text-[var(--color-status-missing-text)]',
    icon: Ban,
  },
};

function StatusPill({
  status,
  label,
}: {
  status: CustomerAccountStatus;
  label: string;
}) {
  const { className, icon: Icon } = STATUS_STYLES[status];

  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-1 text-caption font-semibold ${className}`}
    >
      <Icon className="size-2.5 shrink-0" strokeWidth={3} aria-hidden="true" />
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
      className={`flex shrink-0 items-center gap-1 rounded-[0.375rem] bg-gray-100 px-2 py-1 ${className ?? ''}`}
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

export function CustomerDetailHeader({
  customer,
  onSuspend,
  onRestore,
}: CustomerDetailHeaderProps) {
  const since = formatCustomerSince(customer.customerSince);

  const messageButton = (className: string) =>
    customer.messageThreadTo ? (
      <Link to={customer.messageThreadTo} className={className}>
        <MessageSquare className="size-[1.125rem] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {MESSAGE_LABEL}
      </Link>
    ) : (
      <button type="button" disabled className={`${className} cursor-not-allowed opacity-60`}>
        <MessageSquare className="size-[1.125rem] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {MESSAGE_LABEL}
      </button>
    );

  /*
   * Both directions are outline buttons, never a filled destructive one: this
   * sits beside the primary action at every width, and a solid red block in the
   * header would read as the thing to press.
   */
  const suspensionButton = (className: string) => {
    if (!customer.canBan) return null;

    return customer.isBanned ? (
      <button
        type="button"
        onClick={onRestore}
        className={`${className} border-primary text-primary hover:bg-primary-light`}
      >
        <ShieldCheck className="size-[1.125rem] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Restore access
      </button>
    ) : (
      <button
        type="button"
        onClick={onSuspend}
        className={`${className} border-error/40 text-error hover:bg-error/5`}
      >
        <Ban className="size-[1.125rem] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Suspend account
      </button>
    );
  };

  // Why the account is closed, for whoever opened the record next. Absent unless
  // the suspension is live and carried a note.
  const suspensionNote = customer.isBanned ? (
    <p className="flex items-start gap-2 rounded-card border border-error/25 bg-error/5 px-3.5 py-3 text-small leading-5 text-error">
      <Ban className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <span>
        This account is suspended — they cannot sign in.
        {customer.banReason ? ` Reason: ${customer.banReason}` : ''}
      </span>
    </p>
  ) : null;

  return (
    <>
      {/* ---------- Mobile: the whole block inside a card ---------- */}
      <div className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:hidden">
        <div className="flex items-center gap-3">
          <CustomerAvatar
            id={customer.id}
            initials={customer.initials}
            className="size-14 text-[1.125rem] font-semibold leading-6"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-[1.25rem] font-semibold leading-7 text-text">
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

        {suspensionNote}

        {messageButton(
          'flex h-input w-full items-center justify-center gap-2 rounded-input bg-primary text-body-lg font-semibold text-white transition-colors hover:bg-primary-hover',
        )}

        {suspensionButton(
          'flex h-input w-full items-center justify-center gap-2 rounded-input border bg-white text-body-lg font-semibold transition-colors',
        )}
      </div>

      {/* ---------- Tablet & desktop: on the page background ---------- */}
      {/* The suspension notice takes the full content width under the header
          row, so the desktop row keeps its two-column shape. */}
      <div className="hidden w-full flex-col gap-4 md:flex">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <CustomerAvatar
                id={customer.id}
                initials={customer.initials}
                className="size-16 text-[1.375rem] font-semibold leading-7 lg:size-14 lg:text-[1.25rem]"
              />

              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-3 lg:gap-2.5">
                  <h1 className="truncate text-[1.5rem] font-semibold leading-8 text-text lg:text-[2rem] lg:leading-10">
                    {customer.name}
                  </h1>
                  <CountryChip country={customer.country} />
                  {/* The status pill is a tablet-link element; it reads as useful
                      context at every width, so desktop keeps it too. */}
                  <StatusPill status={customer.status} label={customer.statusLabel} />
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
              one is pinned to the right of the header row. The suspension control
              sits beside it and stays an outline at both widths. */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 self-start lg:self-auto">
            {messageButton(
              'flex h-10 shrink-0 items-center justify-center gap-2 rounded-input border border-primary bg-white px-5 text-body font-semibold text-primary transition-colors hover:bg-primary-light lg:h-input lg:border-transparent lg:bg-primary lg:text-white lg:hover:bg-primary-hover',
            )}

            {suspensionButton(
              'flex h-10 shrink-0 items-center justify-center gap-2 rounded-input border bg-white px-5 text-body font-semibold transition-colors lg:h-input',
            )}
          </div>
        </div>

        {suspensionNote}
      </div>
    </>
  );
}
