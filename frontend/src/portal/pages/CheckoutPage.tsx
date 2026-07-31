import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '@/services/api';
import { PortalLayout } from '../components/PortalLayout';
import {
  CancelTransferDialog,
  CheckoutSummary,
  formatCountdown,
  PaymentMethodChoice,
  UsdtPaymentPanel,
  useCancelPayment,
  useCheckoutQuote,
  useCountdown,
  useCreatePaymentIntent,
  useMarkPaymentSent,
  useNavigationHold,
  usePayment,
  usePaymentMethods,
  WirePaymentPanel,
} from '../features/payments';
import type { PaymentMethodKind } from '../types/payments';
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
 * ── The open USDT window is not allowed to disappear ────────────────────────
 *
 * While a USDT payment window is open we are watching one exact amount at one
 * address for a fixed span of time, and the customer is looking at the only
 * screen that says what that amount is. A tab that quietly loses it — a reload,
 * a stray sidebar click — leaves a live window nobody can see, and money can
 * still be sent into it. So:
 *
 *   · It survives a reload. The window is a database row, and the quote read
 *     carries it back (`activePayment`), so the page resumes mid-countdown.
 *   · It cannot be navigated away from silently. `useNavigationHold` blocks
 *     in-app navigation and prompts on unload while the window is open.
 *   · There are exactly two ways out: cancelling the transfer, which closes the
 *     window server-side and returns to billing, or the countdown running out,
 *     which closes it on its own and releases the page.
 *
 * None of that applies to a bank transfer, and the page deliberately does not
 * hold one. A wire has no countdown, no watched amount, and no rate to go stale;
 * the details persist until it is settled or closed. Trapping a customer on a
 * page they can come back to any time would be a safeguard against nothing.
 *
 * ── Which methods exist is not this file's decision ─────────────────────────
 *
 * The options come from `GET /v1/payments/methods`, because whether we take
 * crypto, whether we take wires, which bank accounts are live, and whether
 * crypto verifies itself are all admin settings. A list hardcoded here would
 * offer a method the backend refuses and keep offering it after it was switched
 * off.
 *
 * Layout: a two-column split from desktop (payment left, summary right rail),
 * stacked on tablet and mobile with the summary first so the customer reads what
 * they owe before how to pay it.
 */

const BILLING_ROUTE = '/app/billing';

function CheckoutHeader({ quoteId, locked }: { quoteId?: string; locked: boolean }) {
  return (
    <header className="flex w-full flex-col gap-2">
      {/*
        The way back out of checkout is the Cancel transfer button while a window
        is open — a back link that the guard would only refuse is worse than no
        link, so it steps aside until the window closes.
      */}
      {locked ? null : (
        <Link
          to={BILLING_ROUTE}
          className="flex items-center gap-2 text-body font-medium text-primary md:hidden"
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          Back to Billing
        </Link>
      )}

      <p className="hidden items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.6px] md:flex">
        {locked ? (
          <>
            <span className="text-gray-500">Dashboard</span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500">Billing &amp; payments</span>
          </>
        ) : (
          <>
            <Link to="/app" className="text-primary hover:underline">
              Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <Link to={BILLING_ROUTE} className="text-primary hover:underline">
              Billing &amp; payments
            </Link>
          </>
        )}
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">Checkout</span>
      </p>

      <h1 className="text-h4 font-bold text-text md:text-h3 md:font-semibold">
        Complete your payment
      </h1>
      <p className="text-[0.8125rem] text-text-secondary md:text-body md:text-gray-500">
        {/* `locked` is the USDT hold — a wire never sets it, so this never
            asks a bank-transfer customer to sit on a page for days. */}
        {locked
          ? 'Keep this page open until your transfer is on its way.'
          : quoteId
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
      <div className="h-64 w-full animate-pulse rounded-card bg-gray-200 lg:w-[22.5rem] lg:shrink-0" />
    </div>
  );
}

function ProblemPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center shadow-sm-elevation">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-[var(--color-status-missing-bg)]">
        <AlertTriangle className="size-6 text-error" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">{title}</p>
      <p className="max-w-[26.25rem] text-body text-gray-500">{body}</p>
      <Link
        to={BILLING_ROUTE}
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
  const navigate = useNavigate();

  const quote = useCheckoutQuote(quoteId);
  const methods = usePaymentMethods();
  const createIntent = useCreatePaymentIntent();
  const cancel = useCancelPayment();
  const markSent = useMarkPaymentSent();

  // The payment being collected. Held in state rather than derived, so the page
  // keeps showing it after the mutation settles.
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const payment = usePayment(paymentId ?? undefined);

  // Which of the two confirmations is open, if either: the button on the panel,
  // or a navigation the guard stopped.
  const [cancelPrompt, setCancelPrompt] = useState<'explicit' | null>(null);

  // A quote already paid on another device shouldn't sit here offering to
  // collect again.
  const alreadyPaid = quote.data?.status === 'paid';

  /*
   * The resume. `activePayment` comes back with the quote, so a reload picks the
   * open window back up instead of dropping the customer on the method choice
   * while it is still being watched.
   */
  const resumeId = createIntent.data?.id ?? quote.data?.activePayment?.id ?? null;

  useEffect(() => {
    if (resumeId) setPaymentId(resumeId);
  }, [resumeId]);

  const activePayment =
    payment.data ?? createIntent.data ?? quote.data?.activePayment ?? null;

  const remaining = useCountdown(activePayment?.usdt?.expiresAt);

  /*
   * Whether the chain credits a USDT payment on its own. An admin can switch
   * automatic verification off, and when they do the panel must not promise a
   * confirmation nobody is watching for — and the customer gets an "I've sent
   * it" control instead, exactly as a wire does.
   */
  const usdtAutoVerified =
    methods.data?.find((method) => method.kind === 'usdt_trc20')?.autoVerified ?? true;

  /*
   * The hold applies to USDT alone. It is open only while the payment is
   * pre-transfer AND the clock has time on it: once it moves to confirming, the
   * customer has already sent the money and the confirming screen says plainly
   * that they can leave — holding them there with no cancel available would be a
   * trap, not a safeguard.
   */
  const windowOpen =
    activePayment?.provider === 'usdt_trc20' &&
    activePayment.status === 'awaiting_payment' &&
    remaining > 0;

  const { blocker, release } = useNavigationHold(windowOpen);

  /*
   * The countdown reaching zero is the server's cue too — it recomputes a lapsed
   * window as expired on read, so one refetch swaps the panel to that face
   * instead of leaving a dead 0:00 on screen. USDT only: a wire carries no
   * `expiresAt`, so `remaining` is 0 for one from the moment it renders and this
   * would refetch it forever.
   */
  const windowLapsed =
    activePayment?.provider === 'usdt_trc20' &&
    activePayment.status === 'awaiting_payment' &&
    remaining <= 0;

  const refetchPayment = payment.refetch;

  useEffect(() => {
    if (windowLapsed) void refetchPayment();
  }, [windowLapsed, refetchPayment]);

  const startPayment = (method: PaymentMethodKind, bankAccountId?: string) => {
    if (!quoteId || createIntent.isPending) return;
    createIntent.mutate({ quoteId, method, ...(bankAccountId ? { bankAccountId } : {}) });
  };

  const confirmSent = () => {
    if (!activePayment || markSent.isPending) return;
    markSent.mutate(activePayment.id);
  };

  /*
   * Cancelling is the deliberate exit, so the hold is released before we move —
   * otherwise the page would block the navigation it just authorised. A blocked
   * navigation resumes where the customer was actually going; the panel's own
   * button returns them to billing, which is where the unpaid quote now is.
   */
  const confirmCancel = () => {
    if (!activePayment || cancel.isPending) return;

    const blocked = blocker.state === 'blocked' ? blocker : null;

    cancel.mutate(activePayment.id, {
      onSuccess: () => {
        setCancelPrompt(null);
        release();

        if (blocked) blocked.proceed();
        else navigate(BILLING_ROUTE, { replace: true });
      },
    });
  };

  const dismissCancel = () => {
    if (cancel.isPending) return;
    cancel.reset();
    setCancelPrompt(null);
    if (blocker.state === 'blocked') blocker.reset();
  };

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
        <div className="w-full lg:order-2 lg:w-[22.5rem] lg:shrink-0">
          <CheckoutSummary quote={quote.data} />
        </div>

        <div className="flex w-full min-w-0 flex-col gap-5 lg:order-1">
          {activePayment ? (
            activePayment.provider === 'wire_transfer' ? (
              <WirePaymentPanel
                payment={activePayment}
                onMarkSent={confirmSent}
                isMarkingSent={markSent.isPending}
                onCancel={() => setCancelPrompt('explicit')}
                isCancelling={cancel.isPending}
              />
            ) : (
              <UsdtPaymentPanel
                payment={activePayment}
                remaining={remaining}
                autoVerified={usdtAutoVerified}
                onMarkSent={confirmSent}
                isMarkingSent={markSent.isPending}
                onCancel={() => setCancelPrompt('explicit')}
                isCancelling={cancel.isPending}
              />
            )
          ) : null}

          {/*
            "I've sent it" failing is worth saying out loud: the customer has
            parted with money and the one signal they tried to give us did not
            land. Beside the panel rather than inside it, so it survives the
            panel re-rendering on the next poll.
          */}
          {activePayment && markSent.isError ? (
            <p
              className="flex items-start gap-2 rounded-card border border-[var(--color-status-missing-text)]/20 bg-[var(--color-status-missing-bg)] p-3.5 text-body text-error"
              role="alert"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
              {markSent.error instanceof ApiError
                ? markSent.error.message
                : "We couldn't record that just now. Your payment is still open — try again, or get in touch."}
            </p>
          ) : null}

          {activePayment ? null : (
            <>
              <PaymentMethodChoice
                methods={methods.data ?? []}
                isLoading={methods.isPending}
                isError={methods.isError}
                startingKind={
                  createIntent.isPending
                    ? (createIntent.variables?.method ?? null)
                    : null
                }
                onSelect={startPayment}
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
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 md:gap-7 lg:gap-8">
          <CheckoutHeader quoteId={quoteId} locked={windowOpen} />
          {renderBody()}
        </div>
      </div>

      <CancelTransferDialog
        open={cancelPrompt === 'explicit' || blocker.state === 'blocked'}
        reason={blocker.state === 'blocked' ? 'navigation' : 'explicit'}
        provider={activePayment?.provider ?? 'usdt_trc20'}
        remainingLabel={remaining > 0 ? formatCountdown(remaining) : null}
        isSubmitting={cancel.isPending}
        error={cancel.error}
        onConfirm={confirmCancel}
        onDismiss={dismissCancel}
      />
    </PortalLayout>
  );
}
