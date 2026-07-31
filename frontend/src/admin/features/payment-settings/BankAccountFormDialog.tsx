import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';

import { FormDialog } from '../../components/FormDialog';
import { Field, FormSection, TextArea, TextInput } from '../../components/FormControls';
import { moveInList } from '../../lib/settings';
import {
  bankAccountCreatePayload,
  bankAccountUpdatePayload,
  deriveBankAccountCode,
  draftFromBankAccount,
  newBankAccountDraft,
  newBankField,
  validateBankAccountDraft,
} from '../../lib/payment-settings';
import type {
  BankAccount,
  BankAccountDraft,
  BankAccountFormErrors,
  BankFieldDraft,
} from '../../types/payment-settings';
import { ToggleSwitch } from '../catalog/detail/ToggleSwitch';

/*
 * Add a bank account, or edit one.
 *
 * The details list is the whole point of this dialog. Banking details are not
 * the same shape in two countries — a US account has a routing number and no
 * IBAN, a UK one has a sort code, a SEPA one has neither — so the admin writes
 * both the label and the value of every line, and the customer's checkout card
 * renders exactly that, in exactly this order. There is no `iban` field anywhere
 * in this app, and adding one would put the next market behind a deploy.
 *
 * Two per-line switches, because they are different decisions:
 *   · Copy button — on for anything a customer must reproduce exactly. A
 *     mistyped account number sends money to a stranger; a bank's postal address
 *     does not need one.
 *   · Highlight — renders the line larger and monospaced. For the one or two
 *     lines that matter most, so the card has a focal point rather than eight
 *     identical rows.
 *
 * The code is guessed from the name while the account is new and shown read-only
 * once it exists: every payment collected through the account stores it, so
 * renaming it would detach them. The same rule locations and carriers follow.
 */

type BankAccountFormDialogProps = {
  open: boolean;
  /** The account being edited, or null to add one. */
  account: BankAccount | null;
  isSaving: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (
    payload:
      | { mode: 'create'; body: ReturnType<typeof bankAccountCreatePayload> }
      | { mode: 'update'; body: ReturnType<typeof bankAccountUpdatePayload> },
  ) => void;
};

export function BankAccountFormDialog({
  open,
  account,
  isSaving,
  error,
  onClose,
  onSubmit,
}: BankAccountFormDialogProps) {
  const [draft, setDraft] = useState<BankAccountDraft>(newBankAccountDraft);
  const [errors, setErrors] = useState<BankAccountFormErrors>({});
  // The code stops tracking the name as soon as the admin edits it by hand.
  const [codeTouched, setCodeTouched] = useState(false);

  const isEdit = account !== null;

  useEffect(() => {
    if (!open) return;
    setDraft(account ? draftFromBankAccount(account) : newBankAccountDraft());
    setErrors({});
    setCodeTouched(account !== null);
  }, [open, account]);

  const patch = (next: Partial<BankAccountDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));

  const setLabel = (label: string) =>
    patch(codeTouched ? { label } : { label, code: deriveBankAccountCode(label) });

  const patchField = (key: string, next: Partial<BankFieldDraft>) =>
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((field) =>
        field.key === key ? { ...field, ...next } : field,
      ),
    }));

  const addField = () =>
    setDraft((prev) => ({ ...prev, fields: [...prev.fields, newBankField()] }));

  const removeField = (key: string) =>
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.filter((field) => field.key !== key),
    }));

  const moveField = (index: number, direction: -1 | 1) =>
    setDraft((prev) => ({
      ...prev,
      fields: moveInList(prev.fields, index, index + direction),
    }));

  const submit = () => {
    const found = validateBankAccountDraft(draft, { isEdit });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit(
      isEdit
        ? { mode: 'update', body: bankAccountUpdatePayload(draft) }
        : { mode: 'create', body: bankAccountCreatePayload(draft) },
    );
  };

  return (
    <FormDialog
      open={open}
      size="lg"
      title={isEdit ? 'Edit bank account' : 'Add a bank account'}
      description={
        isEdit
          ? 'Changes apply to new payments. Anyone mid-transfer keeps the details they were shown.'
          : 'The account customers wire to, and the details their checkout card will show.'
      }
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-caption text-error">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-input rounded-control px-4 text-body font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isSaving}
              className="h-input rounded-control bg-primary px-5 text-body font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Add account'}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <FormSection
          title="Account"
          description="What the customer picks from at checkout."
        >
          <div className="flex flex-col gap-4">
            <Field
              label="Account name"
              htmlFor="bank-label"
              error={errors.label}
              hint="Shown in the payment picker — “USD account (Wise)”, “EUR — Deutsche Bank”."
              required
            >
              <TextInput
                id="bank-label"
                value={draft.label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="USD account"
                error={errors.label}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_7.5rem]">
              <Field
                label="Code"
                htmlFor="bank-code"
                error={errors.code}
                hint={
                  isEdit
                    ? 'Payments are stored under this code, so it cannot be changed.'
                    : 'A short internal slug. Customers never see it.'
                }
                required
              >
                <TextInput
                  id="bank-code"
                  value={draft.code}
                  onChange={(event) => {
                    setCodeTouched(true);
                    patch({ code: event.target.value.toLowerCase() });
                  }}
                  placeholder="usd-primary"
                  disabled={isEdit}
                  error={errors.code}
                  spellCheck={false}
                />
              </Field>

              <Field
                label="Currency"
                htmlFor="bank-currency"
                error={errors.currency}
                required
              >
                <TextInput
                  id="bank-currency"
                  value={draft.currency}
                  onChange={(event) =>
                    patch({ currency: event.target.value.toUpperCase() })
                  }
                  placeholder="USD"
                  maxLength={3}
                  error={errors.currency}
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </Field>
            </div>

            <Field
              label="Note"
              htmlFor="bank-description"
              hint="Optional. Shown under the account name on the customer's card — a clearing time, a branch, anything worth saying."
            >
              <TextArea
                id="bank-description"
                rows={2}
                value={draft.description}
                onChange={(event) => patch({ description: event.target.value })}
                placeholder="Transfers usually clear within 1–3 working days."
              />
            </Field>

            {/* A div rather than a label: the switch is a real button, and
                nesting an interactive control inside a label makes the click
                target ambiguous. `ToggleSwitch` carries its own name. */}
            <div className="flex items-center gap-3 text-body text-text">
              <ToggleSwitch
                checked={draft.active}
                onChange={(next) => patch({ active: next })}
                label="Offer this account"
              />
              <span>
                {draft.active
                  ? 'On — offered at checkout'
                  : 'Off — hidden from checkout, kept on existing payments'}
              </span>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Details the customer sees"
          description="Every line of the checkout card, in this order. Write whatever your bank calls it — IBAN, routing number, sort code."
          action={
            <button
              type="button"
              onClick={addField}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-control border border-gray-300 bg-white px-3 text-body font-medium text-text transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Add detail
            </button>
          }
        >
          <div className="flex flex-col gap-3">
            {draft.fields.map((field, index) => (
              <div
                key={field.key}
                className="flex flex-col gap-3 rounded-card border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex items-start gap-2">
                  <GripVertical
                    className="mt-2.5 size-4 shrink-0 text-gray-400"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />

                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[11rem_1fr]">
                    <TextInput
                      id={`bank-field-label-${field.key}`}
                      value={field.label}
                      onChange={(event) =>
                        patchField(field.key, { label: event.target.value })
                      }
                      placeholder="IBAN"
                      aria-label={`Detail ${index + 1} label`}
                    />
                    <TextInput
                      id={`bank-field-value-${field.key}`}
                      value={field.value}
                      onChange={(event) =>
                        patchField(field.key, { value: event.target.value })
                      }
                      placeholder="GB29 NWBK 6016 1331 9268 19"
                      aria-label={`Detail ${index + 1} value`}
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex shrink-0 items-center">
                    <MoveButton
                      direction="up"
                      label={field.label || `detail ${index + 1}`}
                      disabled={index === 0}
                      onClick={() => moveField(index, -1)}
                    />
                    <MoveButton
                      direction="down"
                      label={field.label || `detail ${index + 1}`}
                      disabled={index === draft.fields.length - 1}
                      onClick={() => moveField(index, 1)}
                    />
                    <button
                      type="button"
                      onClick={() => removeField(field.key)}
                      aria-label={`Remove ${field.label || `detail ${index + 1}`}`}
                      className="flex size-8 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-6">
                  <div className="flex items-center gap-2 text-caption text-text-secondary">
                    <ToggleSwitch
                      checked={field.copyable}
                      onChange={(next) => patchField(field.key, { copyable: next })}
                      label={`Copy button on ${field.label || `detail ${index + 1}`}`}
                    />
                    <span>Copy button</span>
                  </div>

                  <div className="flex items-center gap-2 text-caption text-text-secondary">
                    <ToggleSwitch
                      checked={field.emphasis}
                      onChange={(next) => patchField(field.key, { emphasis: next })}
                      label={`Highlight ${field.label || `detail ${index + 1}`}`}
                    />
                    <span>Highlight</span>
                  </div>
                </div>
              </div>
            ))}

            {errors.fields ? (
              <p role="alert" className="text-caption text-error">
                {errors.fields}
              </p>
            ) : (
              <p className="text-caption text-gray-500">
                An empty row is ignored. At least one filled detail is required —
                a card with nothing under its heading is worse than no card.
              </p>
            )}
          </div>
        </FormSection>
      </div>
    </FormDialog>
  );
}

function MoveButton({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: 'up' | 'down';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === 'up' ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Move ${label} ${direction}`}
      className="flex size-8 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-200 hover:text-text disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
