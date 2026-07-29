import { useEffect, useState } from 'react';

import { deriveKey } from '../../lib/field-registry';
import {
  createPayloadFromDraft,
  draftFromField,
  newFieldDraft,
  updatePayloadFromDraft,
  validateFieldDraft,
} from '../../lib/fields';
import type {
  FieldDefinition,
  FieldDraft,
  FieldFormErrors,
} from '../../types/fields';
import { FIELD_TYPE_OPTIONS, FILE_ACCEPT_OPTIONS } from '../../types/fields';
import { FormDialog } from '../../components/FormDialog';
import { Field, SelectInput, TextArea, TextInput } from '../../components/FormControls';

/*
 * Register a field, or edit a registered one.
 *
 * This is where a question is authored — the one place in the admin where a
 * label, control type, and per-type settings are typed. Everywhere else (the
 * service form builder) only PICKS from what was registered here.
 *
 * Two rules the form enforces visibly rather than by failing on save:
 *
 *   - The key is derived from the label while the field is new, and shown
 *     read-only once it exists. Answers are stored under it, so renaming one
 *     would orphan every answer already recorded against it.
 *   - A field already used by a service cannot change its type. Every answer
 *     given so far was given against the old control, so switching it would
 *     retroactively invalidate answers that were correct when given. The select
 *     is disabled and says why.
 */

type FieldFormDialogProps = {
  open: boolean;
  // The field being edited, or null to register a new one.
  field: FieldDefinition | null;
  isSaving: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (
    payload:
      | { mode: 'create'; body: ReturnType<typeof createPayloadFromDraft> }
      | { mode: 'update'; body: ReturnType<typeof updatePayloadFromDraft> },
  ) => void;
};

export function FieldFormDialog({
  open,
  field,
  isSaving,
  error,
  onClose,
  onSubmit,
}: FieldFormDialogProps) {
  const [draft, setDraft] = useState<FieldDraft>(newFieldDraft);
  const [errors, setErrors] = useState<FieldFormErrors>({});
  // The key stops tracking the label as soon as the admin edits it by hand.
  const [keyTouched, setKeyTouched] = useState(false);

  const isEdit = field !== null;
  const isLocked = isEdit && field.usageCount > 0;

  // Reseed whenever the dialog opens on a different field.
  useEffect(() => {
    if (!open) return;
    setDraft(field ? draftFromField(field) : newFieldDraft());
    setErrors({});
    setKeyTouched(field !== null);
  }, [open, field]);

  const patch = (next: Partial<FieldDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));

  const setLabel = (label: string) => {
    // A new field's key follows its label until the admin overrides it, so
    // registering a question is a one-field action.
    patch(keyTouched ? { label } : { label, key: deriveKey(label) });
  };

  const submit = () => {
    const found = validateFieldDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit(
      isEdit
        ? { mode: 'update', body: updatePayloadFromDraft(draft) }
        : { mode: 'create', body: createPayloadFromDraft(draft) },
    );
  };

  const toggleAccept = (value: string, checked: boolean) =>
    patch({
      accept: checked
        ? [...draft.accept, value]
        : draft.accept.filter((item) => item !== value),
    });

  return (
    <FormDialog
      open={open}
      title={isEdit ? 'Edit field' : 'Register a field'}
      description={
        isEdit
          ? 'Changes apply everywhere this field is used.'
          : 'Register a question once, then add it to any service form.'
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
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Register field'}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Field name"
          htmlFor="field-label"
          error={errors.label}
          hint="What the customer sees above the input."
          required
        >
          <TextInput
            id="field-label"
            value={draft.label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Company name"
            error={errors.label}
          />
        </Field>

        <Field
          label="Field key"
          htmlFor="field-key"
          error={errors.key}
          hint={
            isEdit
              ? 'Answers are stored under this key, so it cannot be changed.'
              : 'Derived from the name. Answers are stored under it and it cannot be changed later.'
          }
        >
          <TextInput
            id="field-key"
            value={draft.key}
            onChange={(event) => {
              setKeyTouched(true);
              patch({ key: event.target.value });
            }}
            placeholder="company_name"
            disabled={isEdit}
            error={errors.key}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Answer type"
            htmlFor="field-type"
            hint={
              isLocked
                ? `Used by ${field.usageCount} service${field.usageCount === 1 ? '' : 's'}, so the type is locked.`
                : undefined
            }
          >
            <SelectInput
              id="field-type"
              value={draft.type}
              disabled={isLocked}
              onChange={(event) =>
                patch({ type: event.target.value as FieldDraft['type'] })
              }
            >
              {FIELD_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field
            label="Group"
            htmlFor="field-category"
            hint="Groups this field in the picker."
          >
            <TextInput
              id="field-category"
              value={draft.category}
              onChange={(event) => patch({ category: event.target.value })}
              placeholder="Company details"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label={draft.type === 'file' ? 'Dropzone prompt' : 'Placeholder'}
            htmlFor="field-placeholder"
          >
            <TextInput
              id="field-placeholder"
              value={draft.placeholder}
              onChange={(event) => patch({ placeholder: event.target.value })}
              placeholder={
                draft.type === 'file'
                  ? 'Drag files here or browse'
                  : 'Shown inside the empty input'
              }
            />
          </Field>

          <Field
            label="Helper text"
            htmlFor="field-hint"
            hint="Shown under the input."
          >
            <TextInput
              id="field-hint"
              value={draft.hint}
              onChange={(event) => patch({ hint: event.target.value })}
              placeholder="Passport or national ID."
            />
          </Field>
        </div>

        {draft.type === 'select' && (
          <Field
            label="Choices"
            htmlFor="field-options"
            error={errors.options}
            hint="One per line. Use value|Label to set a stored value."
            required
          >
            <TextArea
              id="field-options"
              value={draft.options}
              onChange={(event) => patch({ options: event.target.value })}
              rows={5}
              placeholder={'Delaware\nWyoming\nnew-mexico|New Mexico'}
              error={errors.options}
            />
          </Field>
        )}

        {draft.type === 'file' && (
          <div className="flex flex-col gap-4 rounded-card border border-gray-200 bg-gray-50 p-3 md:p-4">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-form-label text-text">
                Accepted file types
              </legend>
              <p className="text-caption text-gray-500">
                Leave all unchecked to accept PDF, JPG, and PNG.
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                {FILE_ACCEPT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-body text-text"
                  >
                    <input
                      type="checkbox"
                      checked={draft.accept.includes(option.value)}
                      onChange={(event) =>
                        toggleAccept(option.value, event.target.checked)
                      }
                      className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Max file size (MB)"
                htmlFor="field-max-size"
                error={errors.maxSizeMb}
                hint="Blank uses the 10 MB default."
              >
                <TextInput
                  id="field-max-size"
                  value={draft.maxSizeMb}
                  onChange={(event) => patch({ maxSizeMb: event.target.value })}
                  inputMode="numeric"
                  placeholder="10"
                  error={errors.maxSizeMb}
                />
              </Field>

              <div className="flex items-end pb-2">
                <label className="flex w-fit cursor-pointer items-center gap-2 text-body text-text">
                  <input
                    type="checkbox"
                    checked={draft.multiple}
                    onChange={(event) => patch({ multiple: event.target.checked })}
                    className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
                  />
                  Allow multiple files
                </label>
              </div>
            </div>
          </div>
        )}

        {isEdit && (
          <label className="flex w-fit cursor-pointer items-center gap-2 border-t border-gray-200 pt-4 text-body text-text">
            <input
              type="checkbox"
              checked={draft.archived}
              onChange={(event) => patch({ archived: event.target.checked })}
              className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
            />
            {/* Archiving retires a field from the picker without touching the
                forms or answers that already reference it — there is no delete. */}
            Archive (hide from the field picker)
          </label>
        )}
      </div>
    </FormDialog>
  );
}
