import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { ApiError } from '@/services/api';
import {
  createResultPayloadFromDraft,
  draftFromResultField,
  newResultFieldDraft,
  updateResultPayloadFromDraft,
  validateResultFieldDraft,
  type ResultFieldDraft,
  type ResultFieldFormErrors,
} from '../../lib/result-fields';
import { deriveKey } from '../../lib/fields';
import {
  RESULT_FIELD_TYPE_OPTIONS,
  type ResultFieldDefinition,
  type ResultFieldType,
} from '../../types/delivery';
import { useCreateResultField, useUpdateResultField } from './queries';

/*
 * Register or edit a returnable fact.
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

// The label the choices textarea takes, per type — a status field's lines carry
// a tone, so the help text has to say so.
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
  const panelRef = useRef<HTMLDivElement>(null);

  const create = useCreateResultField();
  const update = useUpdateResultField();
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const set = <K extends keyof ResultFieldDraft>(
    key: K,
    value: ResultFieldDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const typeLocked = isEdit && (field?.usageCount ?? 0) > 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const found = validateResultFieldDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (isEdit && field) {
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

  const hasChoices = draft.type === 'select' || draft.type === 'status';
  const inputClass =
    'w-full rounded-input border border-gray-200 bg-white px-3 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-gray-900/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-field-dialog-title"
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-modal bg-white shadow-slide-over outline-none md:max-w-[560px] md:rounded-modal"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div className="flex flex-col gap-1">
            <h2
              id="result-field-dialog-title"
              className="text-body-lg font-semibold text-text"
            >
              {isEdit ? 'Edit result field' : 'Register a result field'}
            </h2>
            <p className="text-body text-gray-500">
              A fact a service can deliver to the customer.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-input p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-text"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rf-label" className="text-body font-medium text-text">
                Label
              </label>
              <input
                id="rf-label"
                value={draft.label}
                onChange={(event) => set('label', event.target.value)}
                placeholder="Company name"
                className={`${inputClass} h-11`}
              />
              {errors.label ? (
                <p className="text-caption text-error">{errors.label}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rf-key" className="text-body font-medium text-text">
                Key
              </label>
              <input
                id="rf-key"
                value={draft.key || (isEdit ? '' : deriveKey(draft.label))}
                onChange={(event) => set('key', event.target.value)}
                readOnly={isEdit}
                placeholder="company_name"
                className={`${inputClass} h-11 ${isEdit ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
              />
              <p className="text-caption text-gray-500">
                {isEdit
                  ? 'The key cannot change — delivered values are stored under it.'
                  : 'Derived from the label. Values are stored under this, permanently.'}
              </p>
              {errors.key ? (
                <p className="text-caption text-error">{errors.key}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rf-type" className="text-body font-medium text-text">
                Type
              </label>
              <select
                id="rf-type"
                value={draft.type}
                disabled={typeLocked}
                onChange={(event) =>
                  set('type', event.target.value as ResultFieldType)
                }
                className={`${inputClass} h-11 ${typeLocked ? 'cursor-not-allowed bg-gray-50 text-gray-500' : ''}`}
              >
                {RESULT_FIELD_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-caption text-gray-500">
                {typeLocked
                  ? `Locked — ${field?.usageCount} service${field?.usageCount === 1 ? '' : 's'} already return this. Register a new field instead.`
                  : RESULT_FIELD_TYPE_OPTIONS.find((o) => o.value === draft.type)
                      ?.hint}
              </p>
            </div>

            {hasChoices ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="rf-options" className="text-body font-medium text-text">
                  {draft.type === 'status' ? 'States' : 'Choices'}
                </label>
                <textarea
                  id="rf-options"
                  rows={4}
                  value={draft.options}
                  onChange={(event) => set('options', event.target.value)}
                  placeholder={
                    draft.type === 'status'
                      ? 'active|Active|success\ndissolved|Dissolved|error'
                      : 'Delaware\nWyoming'
                  }
                  className={`${inputClass} py-2.5 font-mono text-small`}
                />
                <p className="text-caption text-gray-500">{optionsHelp(draft.type)}</p>
                {errors.options ? (
                  <p className="text-caption text-error">{errors.options}</p>
                ) : null}
              </div>
            ) : null}

            {draft.type === 'number' ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rf-prefix" className="text-body font-medium text-text">
                    Prefix
                  </label>
                  <input
                    id="rf-prefix"
                    value={draft.prefix}
                    onChange={(event) => set('prefix', event.target.value)}
                    className={`${inputClass} h-11`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rf-suffix" className="text-body font-medium text-text">
                    Suffix
                  </label>
                  <input
                    id="rf-suffix"
                    value={draft.suffix}
                    onChange={(event) => set('suffix', event.target.value)}
                    className={`${inputClass} h-11`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rf-decimals" className="text-body font-medium text-text">
                    Decimals
                  </label>
                  <input
                    id="rf-decimals"
                    value={draft.decimals}
                    onChange={(event) => set('decimals', event.target.value)}
                    className={`${inputClass} h-11`}
                  />
                  {errors.decimals ? (
                    <p className="text-caption text-error">{errors.decimals}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {draft.type === 'date' ? (
              <label className="flex items-center gap-2 text-body text-gray-600">
                <input
                  type="checkbox"
                  checked={draft.withTime}
                  onChange={(event) => set('withTime', event.target.checked)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                />
                Include a time of day
              </label>
            ) : null}

            {draft.type === 'file' ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="rf-size" className="text-body font-medium text-text">
                  Max size (MB)
                </label>
                <input
                  id="rf-size"
                  value={draft.maxSizeMb}
                  onChange={(event) => set('maxSizeMb', event.target.value)}
                  className={`${inputClass} h-11`}
                />
                {errors.maxSizeMb ? (
                  <p className="text-caption text-error">{errors.maxSizeMb}</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="rf-category" className="text-body font-medium text-text">
                  Group
                </label>
                <input
                  id="rf-category"
                  value={draft.category}
                  onChange={(event) => set('category', event.target.value)}
                  placeholder="Registration"
                  className={`${inputClass} h-11`}
                />
                <p className="text-caption text-gray-500">
                  Becomes a card heading on the customer&apos;s page.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="rf-hint" className="text-body font-medium text-text">
                  Hint
                </label>
                <input
                  id="rf-hint"
                  value={draft.hint}
                  onChange={(event) => set('hint', event.target.value)}
                  placeholder="As filed with the state"
                  className={`${inputClass} h-11`}
                />
              </div>
            </div>

            <fieldset className="flex flex-col gap-2 rounded-input bg-gray-50 p-3.5">
              <legend className="px-1 text-body font-medium text-text">Defaults</legend>
              <p className="text-caption text-gray-500">
                A service picking this field inherits these unless it overrides
                them.
              </p>

              <label className="flex items-center gap-2 text-body text-gray-600">
                <input
                  type="checkbox"
                  checked={draft.isPrimary}
                  onChange={(event) => set('isPrimary', event.target.checked)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                />
                Titles the record — its value names the row
              </label>

              <label className="flex items-center gap-2 text-body text-gray-600">
                <input
                  type="checkbox"
                  checked={draft.showInList}
                  onChange={(event) => set('showInList', event.target.checked)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                />
                Show as a column in the customer&apos;s table
              </label>
            </fieldset>

            {isEdit ? (
              <label className="flex items-center gap-2 text-body text-gray-600">
                <input
                  type="checkbox"
                  checked={draft.archived}
                  onChange={(event) => set('archived', event.target.checked)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                />
                Archive — remove from the picker, keep every delivered record
                readable
              </label>
            ) : null}

            {apiError ? (
              <p role="alert" className="text-body text-error">
                {apiError}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-gray-200 p-5 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary h-11 rounded-input px-5 text-body"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-input px-5 text-body disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : null}
              {isEdit ? 'Save changes' : 'Register field'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
