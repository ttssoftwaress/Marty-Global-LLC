import { useState } from 'react';

import { ApiError } from '@/services/api';
import { formatAccountFields } from '../../lib/payment-settings';
import { moveInList } from '../../lib/settings';
import type { BankAccount } from '../../types/payment-settings';
import { ToggleSwitch } from '../catalog/detail/ToggleSwitch';
import {
  ActiveChip,
  SettingsPanel,
  SettingsTh,
} from '../settings/SettingsPanel';
import { ReorderButtons, RowActions } from '../settings/LocationsPanel';
import { BankAccountFormDialog } from './BankAccountFormDialog';
import {
  useBankAccounts,
  useCreateBankAccount,
  useDeleteBankAccount,
  useReorderBankAccounts,
  useUpdateBankAccount,
} from './queries';

/*
 * Bank accounts — where customers wire money to.
 *
 * Built on the same frame the locations and carriers lists use, because it is
 * the same idea a third time: a short, ordered, admin-curated reference list the
 * rest of the system reads. Table from `md` up, cards below it.
 *
 * The one difference worth knowing about is Delete. A location a filing was made
 * under is refused and the admin is told to switch it off; a bank we have
 * stopped using should leave the list rather than sit in it switched off
 * forever. So the backend resolves the verb by usage — removed outright if
 * nothing referenced it, archived if payments did — and this screen reports
 * which happened rather than implying a removal that did not occur.
 *
 * Nothing here can break a payment in flight. Every payment carries a frozen
 * copy of the card it displayed, so editing, retiring, or archiving an account
 * never rewrites instructions somebody is already acting on.
 */

export function BankAccountsPanel({ canWrite }: { canWrite: boolean }) {
  const accounts = useBankAccounts();
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();
  const deleteAccount = useDeleteBankAccount();
  const reorderAccounts = useReorderBankAccounts();

  // Open when set: an account to edit, or `'new'` to add one. One flag rather
  // than two, so the two states cannot both be on.
  const [editing, setEditing] = useState<BankAccount | 'new' | null>(null);
  // What the last delete actually did, since the two outcomes read differently.
  const [removed, setRemoved] = useState<string | null>(null);

  const rows = accounts.data ?? [];

  const openCreate = () => {
    createAccount.reset();
    updateAccount.reset();
    setRemoved(null);
    setEditing('new');
  };

  const openEdit = (account: BankAccount) => {
    createAccount.reset();
    updateAccount.reset();
    setRemoved(null);
    setEditing(account);
  };

  const close = () => setEditing(null);

  const editingAccount = editing === 'new' ? null : editing;
  const isSaving = createAccount.isPending || updateAccount.isPending;

  const message = (error: unknown, fallback: string) =>
    error instanceof ApiError ? error.message : error ? fallback : null;

  const saveError = message(
    createAccount.error ?? updateAccount.error,
    'Something went wrong saving this account. Please try again.',
  );

  /*
   * Errors from the row controls, which have no dialog to report into. The
   * update error is included only while the dialog is closed: with it open, the
   * same failure is already reported beside the button that caused it, and
   * printing it twice reads as two problems.
   */
  const rowError = message(
    deleteAccount.error ??
      reorderAccounts.error ??
      (editing === null ? updateAccount.error : null),
    'Something went wrong updating the bank accounts. Please try again.',
  );

  const move = (index: number, direction: -1 | 1) => {
    deleteAccount.reset();
    setRemoved(null);
    reorderAccounts.mutate(
      moveInList(rows, index, index + direction).map((row) => row.id),
    );
  };

  const toggleActive = (account: BankAccount, active: boolean) => {
    deleteAccount.reset();
    setRemoved(null);
    updateAccount.mutate({ id: account.id, payload: { active } });
  };

  const remove = (account: BankAccount) => {
    deleteAccount.reset();
    deleteAccount.mutate(account.id, {
      onSuccess: (result) =>
        setRemoved(
          result.removed === 'archived'
            ? `“${account.label}” has taken payments, so it was archived rather than deleted — those payments keep their record.`
            : `“${account.label}” was removed.`,
        ),
    });
  };

  return (
    <>
      <SettingsPanel
        title="Bank accounts"
        description="The accounts customers can wire to. Every line of a customer's payment card comes from here — write whatever your bank calls it, and it renders exactly as you enter it."
        addLabel="Add account"
        onAdd={openCreate}
        canWrite={canWrite}
        isLoading={accounts.isLoading}
        error={
          accounts.isError
            ? 'Could not load your bank accounts. Reload the page to try again.'
            : rowError
        }
        emptyTitle="No bank accounts yet"
        emptyBody="Add the account customers should wire to. Until there is at least one with details on it, bank transfer shows at checkout as temporarily unavailable."
        // A failed fetch is not an empty list: showing "No bank accounts yet"
        // over a load error would read as data loss rather than a failed request.
        isEmpty={!accounts.isError && rows.length === 0}
      >
        {/* Table — md and up */}
        <div className="table-scroll hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
          <table className="data-table min-w-[48rem]">
            <thead>
              <tr>
                {canWrite && <SettingsTh>Order</SettingsTh>}
                <SettingsTh>Account</SettingsTh>
                <SettingsTh>Currency</SettingsTh>
                <SettingsTh>Details</SettingsTh>
                <SettingsTh>Payments</SettingsTh>
                <SettingsTh>{canWrite ? 'Offered' : 'Status'}</SettingsTh>
                <th className="w-px px-4" />
              </tr>
            </thead>

            <tbody>
              {rows.map((account, index) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  {canWrite && (
                    <td className="px-4 py-3">
                      <ReorderButtons
                        label={account.label}
                        isFirst={index === 0}
                        isLast={index === rows.length - 1}
                        disabled={reorderAccounts.isPending}
                        onMove={(direction) => move(index, direction)}
                      />
                    </td>
                  )}

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{account.label}</span>
                      <code className="w-fit rounded bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700">
                        {account.code}
                      </code>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {account.currency}
                  </td>

                  <td className="px-4 py-3 text-text-secondary">
                    {formatAccountFields(account)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {account.usage.payments}
                  </td>

                  <td className="px-4 py-3">
                    {canWrite ? (
                      <ToggleSwitch
                        checked={account.active}
                        onChange={(next) => toggleActive(account, next)}
                        label={`Offer ${account.label}`}
                        disabled={updateAccount.isPending}
                      />
                    ) : (
                      <ActiveChip active={account.active} />
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {canWrite && (
                      <RowActions
                        name={account.label}
                        // Always offered: the backend decides between removing
                        // and archiving, so there is no case where this refuses.
                        canDelete
                        isDeleting={deleteAccount.isPending}
                        onEdit={() => openEdit(account)}
                        onDelete={() => remove(account)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards — below md */}
        <ul className="flex flex-col gap-3 md:hidden">
          {rows.map((account, index) => (
            <li
              key={account.id}
              className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-body font-medium text-text">
                    {account.label}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700">
                      {account.code}
                    </code>
                    <span className="text-caption text-gray-500">
                      {account.currency}
                    </span>
                  </span>
                </div>

                {canWrite ? (
                  <ToggleSwitch
                    checked={account.active}
                    onChange={(next) => toggleActive(account, next)}
                    label={`Offer ${account.label}`}
                    disabled={updateAccount.isPending}
                  />
                ) : (
                  <ActiveChip active={account.active} />
                )}
              </div>

              <p className="text-caption text-gray-500">
                {formatAccountFields(account)}
              </p>

              <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
                <span className="text-caption text-gray-500">
                  {account.usage.payments} payment
                  {account.usage.payments === 1 ? '' : 's'}
                </span>

                {canWrite && (
                  <div className="flex items-center gap-1">
                    <ReorderButtons
                      label={account.label}
                      isFirst={index === 0}
                      isLast={index === rows.length - 1}
                      disabled={reorderAccounts.isPending}
                      onMove={(direction) => move(index, direction)}
                    />
                    <RowActions
                      name={account.label}
                      canDelete
                      isDeleting={deleteAccount.isPending}
                      onEdit={() => openEdit(account)}
                      onDelete={() => remove(account)}
                      compact
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* What the last delete actually did — removed, or archived because
            payments reference it. Two different outcomes behind one button, so
            the screen says which. */}
        {removed ? (
          <p role="status" className="text-body text-text-secondary">
            {removed}
          </p>
        ) : null}
      </SettingsPanel>

      <BankAccountFormDialog
        open={editing !== null}
        account={editingAccount}
        isSaving={isSaving}
        error={saveError}
        onClose={close}
        onSubmit={(payload) => {
          if (payload.mode === 'create') {
            createAccount.mutate(payload.body, { onSuccess: close });
            return;
          }

          if (!editingAccount) return;
          createAccount.reset();
          updateAccount.mutate(
            { id: editingAccount.id, payload: payload.body },
            { onSuccess: close },
          );
        }}
      />
    </>
  );
}
