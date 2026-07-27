import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '@/services/api';
import { PortalLayout } from '../components/PortalLayout';
import {
  CheckoutSummary,
  PaymentMethodChoice,
  UsdtPaymentPanel,
  useCheckoutQuote,
  useCreatePaymentIntent,
  usePayment,
} from '../features/payments';
import { usePortalShell } from '../hooks/usePortalShell';

/*
 * Checkout — where a quote becomes a payment.
 *
 * The flow is deliberately two-step rather than auto-starting: landing on the
 * page shows what is owed and the method choice, and only an explicit click
 * creates the payment intent. Creating one on mount would mint a payment (and a
 * watched on-chain amount) for anyone who merely opened the link.
 *
 * Once an intent exists, the panel takes over and the page polls it. The backend
 * poller is what actually advances the payment — nothing here can move it, which
 * is why there is no "I've paid" button to press.
 *
 * Layout: a two-column split from desktop (payment left, summary right rail),
 * stacked on tablet and mobile with the summary first so the customer reads what
 * they owe before how to pay it.
 */

function CheckoutHeader({ quoteId }: { quoteId?: string }) {
  return (
    <header className="flex w-full flex-col gap-2">
      <Link
        to="/app/billing"
        className="flex items-center gap-2 text-body font-medium text-primary md:hidden"
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Back to Billing
      </Link>

      <p className="hidden items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.6px] md:flex">
        <Link to="/app" className="text-primary hover:underline">
          Dashboard
        </Link>
        <span className="text-gray-400">/</span>
        <Link to="/app/billing" className="text-primary hover:underline">
          Billing &amp; payments
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">Checkout</span>
      </p>

      <h1 className="text-h4 font-bold text-text md:text-h3 md:font-semibold">
        Complete your payment
      </h1>
      <p className="text-[13px] text-text-secondary md:text-body md:text-gray-500">
        {quoteId
          ? 'Review what you owe, then choose how to pay.'
          : 'Loading your quote…'}
      </p>
    </header>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:gap-8" aria-hidden="true">
      <div className="h-80 w-full animate-pulse rounded-card bg-gray-200" />
      <div className="h-64 w-full animate-pulse rounded-card bg-gray-200 lg:w-[360px] lg:shrink-0" />
    </div>
  );
}

function ProblemPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center shadow-sm-elevation">
      <span className="flex size-12 items-center justify-center rounded-[24px] bg-[var(--color-status-missing-bg)]">
        <AlertTriangle className="size-6 text-error" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">{title}</p>
      <p className="max-w-[420px] text-body text-gray-500">{body}</p>
      <Link
        to="/app/billing"
        className="btn btn-primary mt-2 h-11 rounded-input px-5 text-body"
      >
        Back to billing
      </Link>
    </section>
  );
}

export function CheckoutPage() {
  const { user, onLogout } = usePortalShell();
  const { quoteId } = useParams<{ quoteId: string }>();

  const quote = useCheckoutQuote(quoteId);
  const createIntent = useCreatePaymentIntent();

  // The payment being collected. Held in state rather than derived, so the page
  // keeps showing it after the mutation settles.
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const payment = usePayment(paymentId ?? undefined);

  // A quote already paid on another device shouldn't sit here offering to
  // collect again.
  const alreadyPaid = quote.data?.status === 'paid';

  useEffect(() => {
    if (createIntent.data?.id) setPaymentId(createIntent.data.id);
  }, [createIntent.data?.id]);

  const startUsdt = () => {
    if (!quoteId || createIntent.isPending) return;
    createIntent.mutate({ quoteId, method: 'usdt_trc20' });
  };

  const activePayment = payment.data ?? createIntent.data ?? null;

  const renderBody = () => {
    if (quote.isLoading) return <CheckoutSkeleton />;

    if (quote.isError) {
      const notFound =
        quote.error instanceof ApiError && quote.error.status === 404;

      return (
        <ProblemPanel
          title={notFound ? 'Quote not found' : 'Something went wrong'}
          body={
            notFound
              ? "We couldn't find this quote. It may have been withdrawn, or the link may be out of date."
              : 'We had trouble loading this quote. Please try again in a moment.'
          }
        />
      );
    }

    if (!quote.data) return <CheckoutSkeleton />;

    if (alreadyPaid && !activePayment) {
      return (
        <ProblemPanel
          title="This quote is already paid"
          body="Nothing further is owed on it. You can see the payment on your billing page."
        />
      );
    }

    if (quote.data.status === 'expired') {
      return (
        <ProblemPanel
          title="This quote has expired"
          body="Ask your account manager for an updated quote and you'll be able to pay it here."
        />
      );
    }

    if (quote.data.status === 'cancelled' || quote.data.status === 'draft') {
      return (
        <ProblemPanel
          title="This quote isn't available for payment"
          body="It may have been withdrawn. Get in touch and we'll sort it out."
        />
      );
    }

    return (
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/*
          Summary first in the DOM so mobile and tablet read it above the payment
          panel; the desktop rail re-orders it to the right without a second tree.
        */}
        <div className="w-full lg:order-2 lg:w-[360px] lg:shrink-0">
          <CheckoutSummary quote={quote.data} />
        </div>

        <div className="flex w-full min-w-0 flex-col gap-5 lg:order-1">
          {activePayment ? (
            <UsdtPaymentPanel payment={activePayment} />
          ) : (
            <>
              <PaymentMethodChoice
                onSelectUsdt={startUsdt}
                isStarting={createIntent.isPending}
              />

              {createIntent.isError ? (
                <p
                  className="flex items-start gap-2 rounded-card border border-[var(--color-status-missing-text)]/20 bg-[var(--color-status-missing-bg)] p-3.5 text-body text-error"
                  role="alert"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {createIntent.error instanceof ApiError
                    ? createIntent.error.message
                    : "We couldn't start this payment. Please try again."}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 md:gap-7 lg:gap-8">
          <CheckoutHeader quoteId={quoteId} />
          {renderBody()}
        </div>
      </div>
    </PortalLayout>
  );
}
