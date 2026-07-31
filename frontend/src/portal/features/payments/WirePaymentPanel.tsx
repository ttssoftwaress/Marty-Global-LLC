import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Landmark,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatMoney } from '../../lib/format';
import type { Payment, PaymentStatusView } from '../../types/payments';
import { CopyField } from './CopyField';
import { PaymentStateChip } from './chips';

/*
 * The bank-transfer panel — the wire mirror of `UsdtPaymentPanel`.
 *
 * Three things make it a different screen rather than a variant of that one, and
 * each is a consequence of nothing here watching a bank account:
 *
 *   · NO COUNTDOWN. A wire can be days in flight, so there is no window to run
 *     out and no rate to go stale. The instructions stay put until the payment is
 *     settled or closed out, and the customer is free to leave the page.
 *   · THE REFERENCE IS THE MATCH. TRC-20 has no memo field, which is why the USDT
 *     amount has to be unique to the digit; a wire carries free text, so the
 *     quote's reference does that job and the amount is simply the amount.
 *   · A PERSON SETTLES IT. "I've sent it" is a claim that reorders the team's
 *     queue — it credits nothing, and the copy says so, because a button that
 *     looked like self-service payment would be read as one.
 *
 * The card's contents are entirely admin-defined. Every labelled line comes from
 * `payment.wire.fields`, frozen when the payment was created, in the order an
 * admin set at `/admin/settings`. There is no `iban` or `swift` anywhere in this
 * file: banking details are not the same shape in two countries, and hardcoding
 * a set of fields here would make every new market a frontend deploy.
 */

function AwaitingState({
  payment,
  onMarkSent,
  isMarkingSent,
  onCancel,
  isCancelling,
}: {
  payment: Payment;
  onMarkSent: () => void;
  isMarkingSent: boolean;
  onCancel: () => void;
  isCancelling: boolean;
}) {
  const wire = payment.wire;
  if (!wire) return null;

  const markedSent = Boolean(payment.markedSentAt);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-5 lg:p-card">
      {/* The two figures that decide whether this transfer can be matched:
          what to send, and what to reference it as. */}
      <div className="flex flex-col gap-4 rounded-card border border-gray-200 bg-gray-50 p-3.5 md:flex-row md:items-start md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-caption font-semibold uppercase tracking-[0.6px] text-gray-500">
            Amount to send
          </p>
          <p className="text-h5 font-semibold text-text">
            {formatMoney(payment.amount)}
          </p>
        </div>

        {wire.reference ? (
          <div className="min-w-0 flex-1 md:max-w-[16rem]">
            <CopyField
              label="Payment reference"
              value={wire.reference}
              hint="Put this in your transfer's reference field so we can match it to your invoice."
            />
          </div>
        ) : null}
      </div>

      {/* The account itself. Heading, optional note, then whatever lines the
          admin defined — rendered exactly as entered, in their order. */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-input bg-primary-light">
            <Landmark className="size-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-body font-semibold text-text">{wire.accountLabel}</p>
            {wire.description ? (
              <p className="text-small leading-5 text-text-secondary">
                {wire.description}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="flex flex-col gap-3.5">
          {wire.fields.map((field, index) =>
            field.copyable ? (
              // `CopyField` renders its own label, so it stands in for the
              // whole dt/dd pair rather than being nested inside one.
              <CopyField
                key={`${field.label}-${index}`}
                label={field.label}
                value={field.value}
              />
            ) : (
              <div key={`${field.label}-${index}`} className="flex flex-col gap-1">
                <dt className="text-caption font-semibold uppercase tracking-[0.6px] text-gray-500">
                  {field.label}
                </dt>
                <dd
                  className={
                    field.emphasis
                      ? 'break-words font-mono text-body font-semibold text-text'
                      : 'whitespace-pre-line break-words text-body text-text'
                  }
                >
                  {field.value}
                </dd>
              </div>
            ),
          )}
        </dl>
      </div>

      <div className="flex items-start gap-2 rounded-card bg-gray-50 p-3.5">
        <Info
          className="mt-0.5 size-4 shrink-0 text-gray-400"
          strokeWidth={2}
          aria-hidden="true"
        />
        <p className="text-small leading-5 text-text-secondary">
          Bank transfers usually take one to three working days to reach us. We
          check for it and confirm your payment as soon as it lands — you can
          close this page, and we&apos;ll email you when it clears.
        </p>
      </div>

      {/*
        The claim, and its receipt. Deliberately phrased as "let us know" rather
        than anything that reads like completing the payment: it moves this
        payment up the team's queue and does nothing else.
      */}
      {markedSent ? (
        <p
          className="flex items-start gap-2 rounded-card border border-[var(--color-status-submitted-text)]/20 bg-[var(--color-status-submitted-bg)] p-3.5 text-body text-[var(--color-status-submitted-text)]"
          role="status"
        >
          <Clock className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Thanks — we know your transfer is on its way. Our team will confirm it
          once it reaches our account.
        </p>
      ) : (
        <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <p className="text-small leading-5 text-text-secondary">
            Already sent it? Letting us know helps us look out for it — it
            doesn&apos;t complete the payment on its own.
          </p>

          <button
            type="button"
            onClick={onMarkSent}
            disabled={isMarkingSent}
            className="btn btn-primary h-11 w-full shrink-0 rounded-control px-5 text-body font-semibold disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
          >
            {isMarkingSent ? 'Letting us know…' : "I've sent the transfer"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <p className="text-small leading-5 text-text-secondary">
          Not paying this way after all? Cancelling closes it and takes you back
          to billing. Your quote stays open.
        </p>

        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="flex h-11 w-full shrink-0 items-center justify-center rounded-control border border-error px-5 text-body font-semibold text-error transition-colors hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
        >
          {isCancelling ? 'Cancelling…' : 'Cancel this payment'}
        </button>
      </div>
    </div>
  );
}

function SucceededState() {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-8 text-center md:py-10">
      <span className="flex size-14 items-center justify-center rounded-[1.75rem] bg-[var(--color-status-approved-bg)]">
        <CheckCircle2 className="size-7 text-success" strokeWidth={2} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-h6 font-semibold text-text md:text-h5">Payment received</h3>
        <p className="max-w-[26.25rem] text-body text-gray-500">
          Thank you — we&apos;ve confirmed your transfer and your order is moving
          forward. A receipt is on its way to your email.
        </p>
      </div>

      <Link
        to="/app/billing"
        className="btn btn-primary mt-1 h-11 rounded-input px-5 text-body"
      >
        Back to billing
      </Link>
    </div>
  );
}

/*
 * A wire that was closed out — by the customer cancelling, or by the team
 * deciding the money never arrived. The reason matters more here than it does
 * for USDT: a wire is closed by a person, and the customer will ask why.
 */
function ProblemState({ status }: { status: PaymentStatusView }) {
  const copy: Partial<Record<PaymentStatusView, { title: string; body: string }>> = {
    cancelled: {
      title: 'This payment was closed',
      body: "It's no longer being expected. Your quote is still open — start again from your billing page whenever you're ready, or get in touch if you've already sent the money.",
    },
  };

  const { title, body } = copy[status] ?? {
    title: 'This payment didn’t complete',
    body: 'Your quote is still open — start again from your billing page, or get in touch if you believe the transfer was sent.',
  };

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-8 text-center md:py-10">
      <span className="flex size-14 items-center justify-center rounded-[1.75rem] bg-[var(--color-status-review-bg)]">
        <AlertTriangle
          className="size-7 text-[var(--color-status-review-text)]"
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-h6 font-semibold text-text md:text-h5">{title}</h3>
        <p className="max-w-[27.5rem] text-body text-gray-500">{body}</p>
      </div>

      <Link
        to="/app/billing"
        className="btn btn-primary mt-1 h-11 rounded-input px-5 text-body"
      >
        Back to billing
      </Link>
    </div>
  );
}

const PROBLEM_STATUSES: PaymentStatusView[] = [
  'failed',
  'expired',
  'cancelled',
  'underpaid',
  'overpaid',
];

type WirePaymentPanelProps = {
  payment: Payment;
  onMarkSent: () => void;
  isMarkingSent: boolean;
  onCancel: () => void;
  isCancelling: boolean;
};

export function WirePaymentPanel({
  payment,
  onMarkSent,
  isMarkingSent,
  onCancel,
  isCancelling,
}: WirePaymentPanelProps) {
  const { status } = payment;

  return (
    <section className="w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3.5 md:px-5 lg:px-card">
        <h2 className="text-h6 font-semibold text-text">Pay by bank transfer</h2>
        <PaymentStateChip status={status} />
      </header>

      {status === 'awaiting_payment' ? (
        <AwaitingState
          payment={payment}
          onMarkSent={onMarkSent}
          isMarkingSent={isMarkingSent}
          onCancel={onCancel}
          isCancelling={isCancelling}
        />
      ) : null}
      {/* `confirming` cannot occur for a wire — nothing reads a bank feed, so
          the only two outcomes are settled by a person or closed by one. */}
      {status === 'succeeded' ? <SucceededState /> : null}
      {PROBLEM_STATUSES.includes(status) ? <ProblemState status={status} /> : null}
    </section>
  );
}
