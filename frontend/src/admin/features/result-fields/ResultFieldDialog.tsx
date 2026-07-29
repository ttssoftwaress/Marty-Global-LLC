import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { ApiError } from '@/services/api';
import { FormDialog } from '../../components/FormDialog';
import {
  Field,
  SelectInput,
  TextArea,
  TextInput,
} from '../../components/FormControls';
import { deriveKey } from '../../lib/field-registry';
import {
  createResultPayloadFromDraft,
  draftFromResultField,
  newResultFieldDraft,
  updateResultPayloadFromDraft,
  validateResultFieldDraft,
  type ResultFieldDraft,
  type ResultFieldFormErrors,
} from '../../lib/result-fields';
import {
  RESULT_FIELD_TYPE_OPTIONS,
  type ResultFieldDefinition,
  type ResultFieldType,
} from '../../types/delivery';
import { useCreateResultField, useUpdateResultField } from './queries';

/*
 * Register or edit a returnable fact.
 *
 * Renders inside the shared admin dialog shell (`components/FormDialog`) with
 * the shared control primitives (`components/FormControls`) — it used to
 * hand-roll both, which is how its inputs drifted to a different height and
 * focus treatment than every other admin form, and how it ended up with a
 * backdrop `div` where the shell uses a real button.
 *
 * Two rules the form makes visible rather than merely enforcing:
 *
 *   - The KEY is immutable once created. Delivered values are stored under it,
 *     so renaming would orphan every record holding one — the edit form shows it
 *     read-only and never sends it.
 *   - The TYPE is frozen once a service returns the fact. Every value already
 *     delivered was validated against the old control, so the select disables
 *     with the usage count as its reason. The backend refuses it too (422); this
 *     just explains why before the admin tries.
 */

type ResultFieldDialogProps = {
  field: ResultFieldDefinition | null; // null = registering a new one
  onClose: () => void;
};

// The help text the choices textarea takes, per type — a status field's lines
// carry a tone, so it has to say so.
function optionsHelp(type: ResultFieldType) {
  if (type === 'status') {
    return 'One state per line, as "value|Label|tone". Tones: neutral, success, warning, error, info.';
  }
  return 'One choice per line. Use "value|Label" when the stored value must differ from what is shown.';
}

export function ResultFieldDialog({ field, onClose }: ResultFieldDialogProps) {
  const isEdit = field !== null;
  const [draft, setDraft] = useState<ResultFieldDraft>(() =>
    field ? draftFromResultField(field) : newResultFieldDraft(),
  );
  const [errors, setErrors] = useState<ResultFieldFormErrors>({});
  // The key stops tracking the label as soon as the admin edits it by hand.
  const [keyTouched, setKeyTouched] = useState(isEdit);

  const create = useCreateResultField();
  const update = useUpdateResultField();
  const pending = create.isPending || update.isPending;

  const set = <K extends keyof ResultFieldDraft>(
    key: K,
    value: ResultFieldDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const setLabel = (label: string) =>
    setDraft((current) => ({
      ...current,
      label,
      // A new fact's key follows its label until the admin overrides it, so
      // registering one is a single-field action.
      ...(keyTouched ? {} : { key: deriveKey(label) }),
    }));

  const typeLocked = isEdit && field.usageCount > 0;
  const hasChoices = draft.type === 'select' || draft.type === 'status';

  const submit = () => {
    const found = validateResultFieldDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (isEdit) {
      update.mutate(
        { fieldId: field.id, payload: updateResultPayloadFromDraft(draft) },
        { onSuccess: onClose },
      );
      return;
    }

    create.mutate(createResultPayloadFromDraft(draft), { onSuccess: onClose });
  };

  const apiError =
    create.error instanceof ApiError
      ? create.error.message
      : update.error instanceof ApiError
        ? update.error.message
        : create.isError || update.isError
          ? 'Something went wrong saving this field.'
          : null;

  return (
    <FormDialog
      open
      title={isEdit ? 'Edit result field' : 'Register a result field'}
      description="A fact a service can deliver to the customer."
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3">
          {apiError && (
            <p role="alert" className="text-caption text-error">
              {apiError}
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
              disabled={pending}
              className="inline-flex h-input items-center justify-center gap-2 rounded-control bg-primary px-5 text-body font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {pending ? (
                <Loader2
                  className="size-4 animate-spin"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              ) : null}
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Register field'}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Label"
          htmlFor="rf-label"
          error={errors.label}
          hint="What the customer sees above the value."
          required
        >
          <TextInput
            id="rf-label"
            value={draft.label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Company name"
            error={errors.label}
          />
        </Field>

        <Field
          label="Key"
          htmlFor="rf-key"
          error={errors.key}
          hint={
            isEdit
              ? 'The key cannot change — delivered values are stored under it.'
              : 'Derived from the label. Values are stored under this, permanently.'
          }
        >
          <TextInput
            id="rf-key"
            value={draft.key}
            onChange={(event) => {
              setKeyTouched(true);
              set('key', event.target.value);
            }}
            placeholder="company_name"
            disabled={isEdit}
            error={errors.key}
          />
        </Field>

        <Field
          label="Type"
          htmlFor="rf-type"
          hint={
            typeLocked
              ? `Locked — ${field.usageCount} service${field.usageCount === 1 ? '' : 's'} already return this. Register a new field instead.`
              : RESULT_FIELD_TYPE_OPTIONS.find(
                  (option) => option.value === draft.type,
                )?.hint
          }
        >
          <SelectInput
            id="rf-type"
            value={draft.type}
            disabled={typeLocked}
            onChange={(event) =>
              set('type', event.target.value as ResultFieldType)
            }
          >
            {RESULT_FIELD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        {hasChoices && (
          <Field
            label={draft.type === 'status' ? 'States' : 'Choices'}
            htmlFor="rf-options"
            error={errors.options}
            hint={optionsHelp(draft.type)}
            required
          >
            <TextArea
              id="rf-options"
              rows={4}
              value={draft.options}
              onChange={(event) => set('options', event.target.value)}
              placeholder={
                draft.type === 'status'
                  ? 'active|Active|success\ndissolved|Dissolved|error'
                  : 'Delaware\nWyoming'
              }
              error={errors.options}
            />
          </Field>
        )}

        {draft.type === 'number' && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Prefix" htmlFor="rf-prefix">
              <TextInput
                id="rf-prefix"
                value={draft.prefix}
                onChange={(event) => set('prefix', event.target.value)}
              />
            </Field>

            <Field label="Suffix" htmlFor="rf-suffix">
              <TextInput
                id="rf-suffix"
                value={draft.suffix}
                onChange={(event) => set('suffix', event.target.value)}
              />
            </Field>

            <Field label="Decimals" htmlFor="rf-decimals" error={errors.decimals}>
              <TextInput
                id="rf-decimals"
                value={draft.decimals}
                onChange={(event) => set('decimals', event.target.value)}
                inputMode="numeric"
                error={errors.decimals}
              />
            </Field>
          </div>
        )}

        {draft.type === 'date' && (
          <label className="flex w-fit cursor-pointer items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={draft.withTime}
              onChange={(event) => set('withTime', event.target.checked)}
              className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
            />
            Include a time of day
          </label>
        )}

        {draft.type === 'file' && (
          <Field
            label="Max size (MB)"
            htmlFor="rf-size"
            error={errors.maxSizeMb}
            hint="Blank uses the 10 MB default."
          >
            <TextInput
              id="rf-size"
              value={draft.maxSizeMb}
              onChange={(event) => set('maxSizeMb', event.target.value)}
              inputMode="numeric"
              placeholder="10"
              error={errors.maxSizeMb}
            />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Group"
            htmlFor="rf-category"
            hint="Becomes a card heading on the customer's page."
          >
            <TextInput
              id="rf-category"
              value={draft.category}
              onChange={(event) => set('category', event.target.value)}
              placeholder="Registration"
            />
          </Field>

          <Field label="Hint" htmlFor="rf-hint" hint="Shown under the value.">
            <TextInput
              id="rf-hint"
              value={draft.hint}
              onChange={(event) => set('hint', event.target.value)}
              placeholder="As filed with the state"
            />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2 rounded-card border border-gray-200 bg-gray-50 p-3 md:p-4">
          <legend className="text-form-label text-text">Defaults</legend>
          <p className="text-caption text-gray-500">
            A service picking this field inherits these unless it overrides them.
          </p>

          <label className="flex w-fit cursor-pointer items-center gap-2 pt-1 text-body text-text">
            <input
              type="checkbox"
              checked={draft.isPrimary}
              onChange={(event) => set('isPrimary', event.target.checked)}
              className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
            />
            Titles the record — its value names the row
          </label>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={draft.showInList}
              onChange={(event) => set('showInList', event.target.checked)}
              className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
            />
            Show as a column in the customer&apos;s table
          </label>
        </fieldset>

        {isEdit && (
          <label className="flex w-fit cursor-pointer items-center gap-2 border-t border-gray-200 pt-4 text-body text-text">
            <input
              type="checkbox"
              checked={draft.archived}
              onChange={(event) => set('archived', event.target.checked)}
              className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
            />
            {/* Archiving retires a fact from the picker without touching the
                records that already hold a value for it — there is no delete. */}
            Archive — remove from the picker, keep every delivered record readable
          </label>
        )}
      </div>
    </FormDialog>
  );
}
