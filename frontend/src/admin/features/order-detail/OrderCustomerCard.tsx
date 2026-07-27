import { ExternalLink, Mail, MessageSquare, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { AdminOrderCustomer } from '../../types/order-detail';
import { CustomerAvatar } from '../customers/CustomerAvatar';
import { SectionCard } from './SectionCard';

/*
 * Who filed the order — the identity a reviewer needs beside the application,
 * with the two ways to act on it: open their full record, or open the support
 * thread.
 *
 * The Message button is a link when a conversation exists and a disabled control
 * when it does not, exactly as on the customer record — a button that opens
 * nothing is worse than one that says it cannot. A customer with no phone on
 * file drops that row rather than printing an empty field.
 */

export function OrderCustomerCard({ customer }: { customer: AdminOrderCustomer }) {
  return (
    <SectionCard title="Customer">
      <div className="flex items-center gap-3">
        <CustomerAvatar
          id={customer.id}
          initials={customer.initials}
          className="size-11 text-body font-semibold"
        />

        <div className="flex min-w-0 flex-col">
          <p className="truncate text-body-lg font-semibold text-text">{customer.name}</p>
          <Link
            to={customer.to}
            className="flex items-center gap-1 text-small font-medium text-primary hover:underline"
          >
            View customer record
            <ExternalLink className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <dl className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <dt className="sr-only">Email</dt>
          <Mail className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
          <dd className="min-w-0 truncate text-body text-text-secondary">{customer.email}</dd>
        </div>

        {customer.phone ? (
          <div className="flex items-center gap-2.5">
            <dt className="sr-only">Phone</dt>
            <Phone className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
            <dd className="min-w-0 truncate text-body text-text-secondary">{customer.phone}</dd>
          </div>
        ) : null}
      </dl>

      {customer.messageThreadTo ? (
        <Link
          to={customer.messageThreadTo}
          className="btn btn-secondary h-11 w-full rounded-input text-body"
        >
          <MessageSquare className="mr-2 size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
          Message customer
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="btn btn-secondary h-11 w-full cursor-not-allowed rounded-input text-body opacity-60"
        >
          <MessageSquare className="mr-2 size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
          No conversation yet
        </button>
      )}
    </SectionCard>
  );
}
