import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { fieldDraft, moveItem } from '../../lib/catalog';
import type { ServiceFieldDraft, ServiceFormErrors } from '../../types/catalog';
import type { FieldDefinition } from '../../types/fields';
import { FieldPicker } from './FieldPicker';
import { PickedFieldRow } from './PickedFieldRow';

/*
 * The questions a customer answers when ordering this service — picked from the
 * field registry.
 *
 * Nothing about a question is authored here. The admin registers a field once on
 * the Form fields screen and this list only chooses which registered questions
 * this service asks, in what order, and whether each is required *on this
 * service*.
 *
 * That is what keeps the answer keys a closed set — every key stored against an
 * order is a registered key, not something typed per service — and what makes
 * the customer's merged master form exact: two services picking the same field
 * are asking the same question by construction, so the order flow asks it once.
 *
 * No registered field can capture money or card data (AGENTS.md): the backend
 * resolves amounts and we never collect card data anywhere, so an admin-authored
 * form must never be able to capture either.
 */

type DetailFieldEditorProps = {
  fields: ServiceFieldDraft[];
  errors: ServiceFormErrors;
  // The live registry to pick from.
  registry: FieldDefinition[];
  isRegistryLoading: boolean;
  onChange: (fields: ServiceFieldDraft[]) => void;
};

export function DetailFieldEditor({
  fields,
  errors,
  registry,
  isRegistryLoading,
  onChange,
}: DetailFieldEditorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const byKey = useMemo(
    () => new Map(registry.map((definition) => [definition.key, definition])),
    [registry],
  );

  const updateField = (index: number, patch: Partial<ServiceFieldDraft>) => {
    onChange(
      fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 && !isPickerOpen ? (
        <p className="rounded-card border border-dashed border-gray-300 px-4 py-5 text-center text-body text-gray-500">
          No questions yet. Customers ordering this service will only supply the
          application-wide notes and documents.
        </p>
      ) : null}

      {fields.map((field, index) => (
        <PickedFieldRow
          key={field.key}
          field={field}
          definition={byKey.get(field.fieldKey)}
          index={index}
          fieldCount={fields.length}
          error={errors[`fields.${index}.fieldKey`]}
          onChange={(patch) => updateField(index, patch)}
          onRemove={() => onChange(fields.filter((_, i) => i !== index))}
          onMove={(to) => onChange(moveItem(fields, index, to))}
        />
      ))}

      <FieldPicker
        open={isPickerOpen}
        fields={registry}
        isLoading={isRegistryLoading}
        pickedKeys={fields.map((field) => field.fieldKey)}
        onPick={(definition) => {
          onChange([...fields, fieldDraft(definition.key)]);
          setIsPickerOpen(false);
        }}
        onClose={() => setIsPickerOpen(false)}
      />

      {!isPickerOpen && (
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="flex h-10 items-center justify-center gap-2 rounded-control border border-dashed border-gray-300 px-4 text-body font-medium text-primary transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Add question
        </button>
      )}
    </div>
  );
}
