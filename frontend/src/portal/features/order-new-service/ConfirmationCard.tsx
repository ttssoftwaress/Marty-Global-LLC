import { Fragment, type ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type { OrderConfirmation } from '../../types/order-new-service';

/*
 * Step 3 (Application submitted) — the centered confirmation card, the whole of
 * this screen. One responsive tree covers all three Figma links; Tailwind swaps
 * the parts that differ:
 *   - reference rows: label ↔ value on one line at md+ (desktop, tablet),
 *     stacked (label over value) on mobile.
 *   - button row: side-by-side at md+, stacked with the primary CTA on top on
 *     mobile.
 * The card is centered vertically on desktop, sits below a breadcrumb on tablet,
 * and starts near the top on mobile — the page owns that outer offset.
 *
 * Everything shown comes from the `confirmation` payload the submit endpoint
 * returns; nothing is hardcoded. The body copy names each ordered service in
 * bold and the SERVICES row lists them, both built from `serviceNames` so any
 * number of services renders correctly, not just the two in the design.
 */

const ORDERS_ROUTE = '/app/orders';
const NEW_SERVICE_ROUTE = '/app/order';

type ConfirmationCardProps = {
  confirmation: OrderConfirmation;
};

// The service names joined into a readable list with each name bolded inline —
// "A", "A and B", "A, B, and C". Returns nodes so the emphasis survives the
// join, and stays correct for any count (the design only shows two).
function ServiceNamesInline({ names }: { names: string[] }): ReactNode {
  return names.map((name, index) => {
    const isLast = index === names.length - 1;
    const isFirst = index === 0;
    let separator = '';
    if (!isFirst) {
      // Oxford-style: "A and B" for two, "A, B, and C" for three or more.
      separator = names.length > 2 ? ', ' : ' ';
      if (isLast) separator += 'and ';
    }

    return (
      <Fragment key={name}>
        {separator}
        <span className="font-semibold text-text">{name}</span>
      </Fragment>
    );
  });
}

type ReferenceRow = { label: string; value: string };

function ReferenceInfoBlock({ rows }: { rows: ReferenceRow[] }) {
  return (
    <dl className="flex w-full flex-col gap-3 rounded-input bg-gray-50 p-4 md:border md:border-gray-200">
      {rows.map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-3"
        >
          <dt className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
            {label}
          </dt>
          <dd className="text-body font-medium text-text md:text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ConfirmationCard({ confirmation }: ConfirmationCardProps) {
  const navigate = useNavigate();
  const { reference, submittedAt, serviceNames, confirmationEmail } = confirmation;

  const referenceRows: ReferenceRow[] = [
    { label: 'Reference', value: reference },
    { label: 'Submitted', value: formatOrderDate(submittedAt) },
    { label: 'Services', value: serviceNames.join(', ') },
  ];

  return (
    <div className="flex w-full max-w-[560px] flex-col items-center gap-8 rounded-card border border-gray-200 bg-white p-6 shadow-sm-elevation md:p-10">
      {/* Success badge — approved-green circle with a check (lucide, not the
          exported asset per the design guide). */}
      <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-status-approved-bg">
        <Check className="size-8 text-status-approved-text" strokeWidth={2.5} aria-hidden="true" />
      </div>

      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-h4 font-semibold text-text">Application submitted</h1>
        <p className="text-body leading-[1.5] text-text-secondary">
          Your application for <ServiceNamesInline names={serviceNames} /> has been
          received. Our team will review your details and send a personalized quote
          with a secure payment link within 1–2 business days.
        </p>
      </div>

      <ReferenceInfoBlock rows={referenceRows} />

      <div className="flex w-full flex-col items-center gap-6">
        <p className="text-small text-gray-400">
          A confirmation email has been sent to {confirmationEmail}.
        </p>
        <hr className="h-px w-full border-0 bg-gray-200" />
      </div>

      {/* Buttons: primary on top on mobile (stacked, reversed order), then a
          side-by-side row from md up with the secondary on the left. */}
      <div className="flex w-full flex-col-reverse gap-3 md:flex-row md:gap-4">
        <Link
          to={NEW_SERVICE_ROUTE}
          className="btn btn-secondary w-full rounded-input md:flex-1"
        >
          Order another service
        </Link>
        <button
          type="button"
          onClick={() => navigate(ORDERS_ROUTE)}
          className="btn btn-primary w-full rounded-input md:flex-1"
        >
          View in my orders
          <ArrowRight className="ml-2 size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
