import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  BankAccount,
  BankAccountCreatePayload,
  BankAccountDeleteResult,
  BankAccountUpdatePayload,
  PaymentSettings,
  PaymentSettingsPayload,
} from '../../types/payment-settings';

/*
 * Payment configuration data layer — how we collect, and the bank accounts
 * customers wire to.
 *
 * Every write here changes what the checkout offers, so each one drops the
 * customer-facing method list as well as its own cache. That list is what a
 * customer's browser reads (`GET /v1/payments/methods`), and it is the whole
 * reason this configuration is data rather than environment variables: a change
 * has to reach the checkout without a deploy.
 */

export const paymentSettingsKey = () => ['admin', 'payment-settings'] as const;
export const bankAccountsKey = () =>
  ['admin', 'payment-settings', 'bank-accounts'] as const;

// GET /v1/admin/payment-settings
export function usePaymentSettings() {
  return useQuery({
    queryKey: paymentSettingsKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<PaymentSettings>>('/admin/payment-settings').then(
        (res) => res.data,
      ),
  });
}

// GET /v1/admin/payment-settings/bank-accounts — the whole set, inactive rows
// included, because this is the screen where a retired account is turned back on.
export function useBankAccounts() {
  return useQuery({
    queryKey: bankAccountsKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<{ accounts: BankAccount[] }>>(
        '/admin/payment-settings/bank-accounts',
      ).then((res) => res.data.accounts),
  });
}

/*
 * What a payment-configuration write reaches beyond its own cache. Named rather
 * than inlined per mutation so a new consumer is added in one place.
 *
 * `payableAccounts` on the settings row is derived from the account list, so
 * every account write invalidates the settings too — otherwise the "wire is on
 * but nothing is payable" warning would go stale the moment it stopped being
 * true.
 */
function invalidatePaymentConfig(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: paymentSettingsKey() });
  void queryClient.invalidateQueries({ queryKey: bankAccountsKey() });
  // The customer checkout's method list, in whichever tabs are open.
  void queryClient.invalidateQueries({ queryKey: ['payments', 'methods'] });
}

// PATCH /v1/admin/payment-settings
export function useUpdatePaymentSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PaymentSettingsPayload) =>
      apiFetch<ApiSuccess<PaymentSettings>>('/admin/payment-settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: (settings) => {
      // The response is the saved row — seed it so the form does not flash back
      // through its previous values while a refetch lands.
      queryClient.setQueryData(paymentSettingsKey(), settings);
      invalidatePaymentConfig(queryClient);
    },
  });
}

// POST /v1/admin/payment-settings/bank-accounts
export function useCreateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BankAccountCreatePayload) =>
      apiFetch<ApiSuccess<BankAccount>>('/admin/payment-settings/bank-accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: () => invalidatePaymentConfig(queryClient),
  });
}

/*
 * PATCH /v1/admin/payment-settings/bank-accounts/:id — edit, retire, or restore.
 *
 * Also the retire action: `active: false` drops the account from the checkout
 * while the payments already collected through it keep resolving. Payments in
 * flight are unaffected by any edit — each carries a frozen copy of the card it
 * displayed, which is exactly so that fixing a typo here never rewrites
 * instructions somebody is acting on.
 */
export function useUpdateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BankAccountUpdatePayload }) =>
      apiFetch<ApiSuccess<BankAccount>>(
        `/admin/payment-settings/bank-accounts/${id}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: () => invalidatePaymentConfig(queryClient),
  });
}

/*
 * DELETE /v1/admin/payment-settings/bank-accounts/:id
 *
 * Resolves by usage on the backend: an account nothing referenced is removed
 * outright, one that has taken payments is archived. The response says which,
 * so the screen can report what actually happened rather than implying a hard
 * delete that did not occur.
 */
export function useDeleteBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiSuccess<BankAccountDeleteResult>>(
        `/admin/payment-settings/bank-accounts/${id}`,
        { method: 'DELETE' },
      ).then((res) => res.data),
    onSuccess: () => invalidatePaymentConfig(queryClient),
  });
}

/*
 * PUT /v1/admin/payment-settings/bank-accounts/order — the complete sequence,
 * not one row's position. The order is a property of the list, so sending all of
 * it means two admins reordering at once cannot interleave into a ranking
 * neither chose.
 */
export function useReorderBankAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<ApiSuccess<{ accounts: BankAccount[] }>>(
        '/admin/payment-settings/bank-accounts/order',
        { method: 'PUT', body: JSON.stringify({ ids }) },
      ).then((res) => res.data.accounts),
    onSuccess: (accounts, _ids, _ctx) => {
      // Seed rather than refetch, so rows do not flicker back through their old
      // positions.
      queryClient.setQueryData(bankAccountsKey(), accounts);
      invalidatePaymentConfig(queryClient);
    },
  });
}
