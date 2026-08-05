import {
  DetailField,
  DetailGrid,
  DetailPanel,
  DetailSection,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { BankAccount } from '../../types/payment-settings';

/*
 * The expanded panel under a bank account — the instruction card exactly as a
 * customer is shown it.
 *
 * The row's "Details" column can only say how many fields there are. What
 * matters is what they say: banking is not the same shape in two countries, so
 * these are admin-defined label/value rows (AGENTS.md — never fixed
 * `iban`/`swift` columns), and checking that an IBAN is right is the reason
 * anyone opens this screen.
 *
 * No fetch: the accounts list is a handful of configuration rows and already
 * carries its fields, so a per-row read would ask the server for something the
 * browser is holding. The lazy part here is the rendering.
 */

export function BankAccountDetails({ account }: { account: BankAccount }) {
  return (
    <DetailPanel>
      <DetailGrid>
        <DetailField label="Code" mono>
          {account.code}
        </DetailField>
        <DetailField label="Currency">{account.currency}</DetailField>
        <DetailField label="Payments taken">
          {account.usage.payments}
        </DetailField>
        <DetailField label="Last updated">
          {formatOrderDate(account.updatedAt)}
        </DetailField>
      </DetailGrid>

      {account.description ? (
        <DetailSection title="Note shown to the customer">
          <p className="text-body text-text">{account.description}</p>
        </DetailSection>
      ) : null}

      <DetailSection title="Instructions the customer sees">
        {account.fields.length === 0 ? (
          <p className="text-body text-gray-500">
            No details have been added yet, so this account cannot be offered at
            checkout.
          </p>
        ) : (
          <dl className="flex flex-col gap-1.5">
            {account.fields.map((field, index) => (
              <div
                key={`${field.label}-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gray-100 py-1.5 last:border-b-0"
              >
                <dt className="shrink-0 text-small text-gray-500">
                  {field.label}
                </dt>
                <dd className="min-w-0 break-all text-right font-mono text-small text-text">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </DetailSection>
    </DetailPanel>
  );
}
