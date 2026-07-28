import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type { CheckoutQuote, Payment } from '../../types/payments';
import { billingOverviewKey } from '../billing/queries';

/*
 * The checkout data layer.
 *
 * Two things here are deliberate rather than incidental:
 *
 * 1. The mutation sends an `Idempotency-Key`. AGENTS.md requires mutating
 *    payment endpoints to be retry-safe, and TanStack Query retries on its own —
 *    without a stable key a retried "start payment" could create a second
 *    payment asking the customer for a second transfer. The key is minted once
 *    per attempt and reused across that attempt's retries.
 *
 * 2. The payment query polls while a transfer is in flight and stops once the
 *    payment reaches a terminal state, so a settled checkout isn't hitting the
 *    API forever in a background tab.
 */

export const checkoutQuoteKey = (quoteId: string) =>
  ['payments', 'quote', quoteId] as const;

export const paymentKey = (paymentId: string) =>
  ['payments', 'payment', paymentId] as const;

// GET /v1/payments/quotes/:quoteId — the quote being paid, with its line items.
export function useCheckoutQuote(quoteId: string | undefined) {
  return useQuery({
    queryKey: checkoutQuoteKey(quoteId ?? ''),
    enabled: Boolean(quoteId),
    queryFn: () =>
      apiFetch<ApiSuccess<CheckoutQuote>>(`/payments/quotes/${quoteId}`).then(
        (res) => res.data,
      ),
  });
}

// Statuses where nothing further will change on its own, so polling can stop.
const TERMINAL_STATUSES: Payment['status'][] = [
  'succeeded',
  'failed',
  'expired',
  'underpaid',
  'overpaid',
];

const POLL_INTERVAL_MS = 10_000;

/*
 * GET /v1/payments/:paymentId — the live payment. Polled while the customer is
 * waiting for their transfer to be seen and confirmed; the backend's poller is
 * what actually advances it, so this is a read, never a trigger.
 */
export function usePayment(paymentId: string | undefined) {
  return useQuery({
    queryKey: paymentKey(paymentId ?? ''),
    enabled: Boolean(paymentId),
    queryFn: () =>
      apiFetch<ApiSuccess<Payment>>(`/payments/${paymentId}`).then(
        (res) => res.data,
      ),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return POLL_INTERVAL_MS;
    },
    // Keep polling while the customer has the tab in the background — they may
    // send the transfer from a phone and come back to a settled screen.
    refetchIntervalInBackground: true,
  });
}

// A key that is stable for one attempt but different across attempts, so a
// retry resolves to the same payment while a deliberate re-try after a failure
// starts a fresh one.
function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/*
 * POST /v1/payments/intents — start (or resume) collecting on a quote.
 *
 * The body carries a quote id and a method, never an amount: the client does not
 * decide what is owed (AGENTS.md, Money).
 */
export function useCreatePaymentIntent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { quoteId: string; method: 'usdt_trc20' }) =>
      apiFetch<ApiSuccess<Payment>>('/payments/intents', {
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        body: JSON.stringify(input),
      }).then((res) => res.data),

    onSuccess: (payment) => {
      // Seed the payment cache so the waiting screen renders without a second
      // round trip.
      queryClient.setQueryData(paymentKey(payment.id), payment);
      // What's owed has changed shape; let billing refetch when it's next shown.
      void queryClient.invalidateQueries({ queryKey: billingOverviewKey() });
    },
  });
}
