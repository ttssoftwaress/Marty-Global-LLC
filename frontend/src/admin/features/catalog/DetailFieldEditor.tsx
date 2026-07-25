import { Plus, Trash2 } from 'lucide-react';

import { emptyFieldDraft, slugify } from '../../lib/catalog';
import type { ServiceFieldDraft, ServiceFormErrors } from '../../types/catalog';
import { SERVICE_FIELD_TYPE_OPTIONS } from '../../types/catalog';
import { Field, SelectInput, TextArea, TextInput } from './FormControls';

/*
 * The questions a customer answers when ordering this service — the admin side
 * of the portal's Step 2 (Application details) form.
 *
 * This is why the catalog is data rather than code in both apps: the portal
 * renders whatever fields are defined here, by type, so adding a question to a
 * service is an admin action, not a frontend deploy in either app.
 *
 * The field key (`name`) is what the customer's answer is stored under, so it
 * has to stay stable once orders reference it. It is derived from the label
 * while the row is new and left alone after that — renaming a live field's key
 * would orphan every answer already recorded against it, so the placeholder
 * shows the derived key rather than silently rewriting a saved one.
 *
 * No field type here captures money or card data, by design (AGENTS.md): the
 * backend resolves amounts and Stripe holds the card, so a generic
 * admin-authored form must never be able to collect either.
 */

type DetailFieldEditorProps = {
  fields: ServiceFieldDraft[];
  errors: ServiceFormErrors;
  onChange: (fields: ServiceFieldDraft[]) => void;
};

export function DetailFieldEditor({
  fields,
  errors,
  onChange,
}: DetailFieldEditorProps) {
  const updateField = (index: number, patch: Partial<ServiceFieldDraft>) => {
    onChange(
      fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <p className="rounded-card border border-dashed border-gray-300 px-4 py-5 text-center text-body text-gray-500">
          No questions yet. Customers ordering this service will only supply the
          application-wide notes and documents.
        </p>
      ) : null}

      {fields.map((field, index) => (
        <div
          key={field.key}
          className="flex flex-col gap-3 rounded-card border border-gray-200 bg-gray-50 p-3 md:p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
              Question {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeField(index)}
              className="flex size-8 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-200 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={`Remove question ${index + 1}`}
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Label"
              htmlFor={`field-${field.key}-label`}
              error={errors[`fields.${index}.label`]}
              required
            >
              <TextInput
                id={`field-${field.key}-label`}
                value={field.label}
                onChange={(event) =>
                  updateField(index, { label: event.target.value })
                }
                placeholder="Preferred company name"
                error={errors[`fields.${index}.label`]}
              />
            </Field>

            <Field label="Type" htmlFor={`field-${field.key}-type`}>
              <SelectInput
                id={`field-${field.key}-type`}
                value={field.type}
                onChange={(event) =>
                  updateField(index, {
                    type: event.target
                      .value as ServiceFieldDraft['type'],
                  })
                }
              >
                {SERVICE_FIELD_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              label="Field key"
              htmlFor={`field-${field.key}-name`}
              error={errors[`fields.${index}.name`]}
              hint="Leave blank to derive it from the label."
            >
              <TextInput
                id={`field-${field.key}-name`}
                value={field.name}
                onChange={(event) =>
                  updateField(index, { name: event.target.value })
                }
                placeholder={slugify(field.label) || 'company-name'}
                error={errors[`fields.${index}.name`]}
              />
            </Field>

            <Field label="Placeholder" htmlFor={`field-${field.key}-placeholder`}>
              <TextInput
                id={`field-${field.key}-placeholder`}
                value={field.placeholder}
                onChange={(event) =>
                  updateField(index, { placeholder: event.target.value })
                }
                placeholder="Shown inside the empty input"
              />
            </Field>
          </div>

          {field.type === 'select' ? (
            <Field
              label="Choices"
              htmlFor={`field-${field.key}-options`}
              error={errors[`fields.${index}.options`]}
              hint="One per line. Use value|Label to set a stored value."
              required
            >
              <TextArea
                id={`field-${field.key}-options`}
                value={field.options}
                onChange={(event) =>
                  updateField(index, { options: event.target.value })
                }
                rows={4}
                placeholder={'Delaware\nWyoming\nnew-mexico|New Mexico'}
                error={errors[`fields.${index}.options`]}
              />
            </Field>
          ) : null}

          <label className="flex w-fit cursor-pointer items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(event) =>
                updateField(index, { required: event.target.checked })
              }
              className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
            />
            Required
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...fields, emptyFieldDraft()])}
        className="flex h-10 items-center justify-center gap-2 rounded-control border border-dashed border-gray-300 px-4 text-body font-medium text-primary transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Add question
      </button>
    </div>
  );
}
