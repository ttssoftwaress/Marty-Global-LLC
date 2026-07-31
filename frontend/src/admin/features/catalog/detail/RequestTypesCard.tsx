import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ApiError } from '@/services/api';
import { deriveKey } from '../../../lib/field-registry';
import type { ServiceRequestTypeDraft } from '../../../types/delivery';
import type { FieldDefinition } from '../../../types/fields';
import { useFieldPicker } from '../../fields/queries';
import { FieldPicker } from '../FieldPicker';
import { Field, TextInput } from '../../../components/FormControls';
import { useUpdateRequestTypes } from '../queries';
import { DashedAddButton, DetailCard } from './DetailCard';

/*
 * "What customers can ask for" — the buttons on this service's result page.
 *
 * Each row here becomes one button the customer presses on a delivered record,
 * and pressing it raises a ticket in the `/admin/requests` queue. This is the
 * entire self-service surface for a completed service, and adding one is a
 * catalog change rather than a deploy in either app.
 *
 * The optional intake form references the REQUEST registry — the same vocabulary
 * the order form asks from — so "which address should we ship the copy to?"
 * reuses a question that already exists rather than inventing a third list.
 *
 * A type the admin removes is DEACTIVATED, never deleted: requests already
 * raised under it point at the row, and the queue has to keep reading them. That
 * is the same archive-not-delete rule both registries follow.
 */

type RequestTypesCardProps = {
  serviceId: string;
  requestTypes: ServiceRequestTypeDraft[];
};

function emptyRequestType(): ServiceRequestTypeDraft {
  return { key: '', label: '', active: true, fields: [] };
}

function RequestTypeRow({
  type,
  index,
  registry,
  isRegistryLoading,
  onChange,
  onRemove,
}: {
  type: ServiceRequestTypeDraft;
  index: number;
  registry: FieldDefinition[];
  isRegistryLoading: boolean;
  onChange: (patch: Partial<ServiceRequestTypeDraft>) => void;
  onRemove: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const askQuestionRef = useRef<HTMLButtonElement>(null);
  const byKey = useMemo(
    () => new Map(registry.map((field) => [field.key, field])),
    [registry],
  );

  const fields = type.fields ?? [];

  // Several rows render at once, so the control ids are per-row: a duplicated
  // id would point every label at the first row's input.
  const rowId = `request-type-${type.id ?? `new-${index}`}`;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
          Action {index + 1}
        </span>

        <div className="flex shrink-0 items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-caption text-gray-600">
            <input
              type="checkbox"
              checked={type.active}
              onChange={(event) => onChange({ active: event.target.checked })}
              className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
            />
            Offered
          </label>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${type.label || 'this action'}`}
            className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-error"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Button label" htmlFor={`${rowId}-label`}>
          <TextInput
            id={`${rowId}-label`}
            value={type.label}
            onChange={(event) => {
              const label = event.target.value;

              onChange({
                label,
                // The key identifies the action within the service and is what a
                // raised request records. Derived while it is new, then frozen —
                // changing it on a live type would orphan its history.
                ...(type.id ? {} : { key: deriveKey(label).replace(/_/g, '-') }),
              });
            }}
            placeholder="Request a certified copy"
          />
        </Field>

        <Field
          label="Turnaround"
          htmlFor={`${rowId}-turnaround`}
          hint="Free text, shown beside the button."
        >
          <TextInput
            id={`${rowId}-turnaround`}
            value={type.turnaround ?? ''}
            onChange={(event) => onChange({ turnaround: event.target.value })}
            placeholder="Typically 3–5 business days"
          />
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor={`${rowId}-description`}
        hint="One line explaining what the customer gets."
      >
        <TextInput
          id={`${rowId}-description`}
          value={type.description ?? ''}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="A stamped copy of your formation certificate."
        />
      </Field>

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
        <p className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
          What to ask when they press it
        </p>

        {fields.length === 0 ? (
          <p className="text-caption text-gray-500">
            Nothing — the button raises the request immediately.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {fields.map((ref, fieldIndex) => {
              const definition = byKey.get(ref.fieldKey);

              return (
                <div
                  key={ref.fieldKey}
                  className="flex items-center gap-3 rounded-input border border-gray-200 px-3 py-2"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body text-text">
                      {definition?.label ?? ref.fieldKey}
                    </span>
                    <span className="truncate text-caption text-gray-500">
                      {definition?.key ?? 'No longer in the registry — remove it.'}
                    </span>
                  </span>

                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-caption text-gray-600">
                    <input
                      type="checkbox"
                      checked={ref.required ?? false}
                      onChange={(event) =>
                        onChange({
                          fields: fields.map((item, i) =>
                            i === fieldIndex
                              ? { ...item, required: event.target.checked }
                              : item,
                          ),
                        })
                      }
                      className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
                    />
                    Required
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        fields: fields.filter((_, i) => i !== fieldIndex),
                      })
                    }
                    aria-label={`Remove ${definition?.label ?? ref.fieldKey}`}
                    className="flex size-7 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:text-error"
                  >
                    <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <FieldPicker
          open={pickerOpen}
          fields={registry}
          isLoading={isRegistryLoading}
          pickedKeys={fields.map((ref) => ref.fieldKey)}
          onPick={(definition) => {
            onChange({ fields: [...fields, { fieldKey: definition.key }] });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          triggerRef={askQuestionRef}
        />

        {!pickerOpen ? (
          <button
            ref={askQuestionRef}
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-fit text-body font-medium text-primary hover:underline"
          >
            + Ask a question
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function RequestTypesCard({ serviceId, requestTypes }: RequestTypesCardProps) {
  const [types, setTypes] = useState<ServiceRequestTypeDraft[]>(requestTypes);

  useEffect(() => setTypes(requestTypes), [requestTypes]);

  const registry = useFieldPicker();
  const save = useUpdateRequestTypes(serviceId);

  const error =
    save.error instanceof ApiError
      ? save.error.message
      : save.isError
        ? 'Something went wrong saving these actions.'
        : null;

  // A type with no label has no button to render, and one with no key cannot be
  // recorded against a request — both are dropped rather than sent.
  const submittable = types.filter(
    (type) => type.label.trim() && type.key.trim(),
  );

  return (
    <DetailCard
      title="What customers can ask for"
      description="Each action becomes a button on the customer’s record for this service. Pressing it raises a ticket in the Service requests queue."
    >
      {types.length === 0 ? (
        <p className="rounded-card border border-dashed border-gray-300 px-4 py-6 text-center text-body text-gray-500">
          No follow-up actions yet. Customers will see their record but have
          nothing to ask for.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {types.map((type, index) => (
            <RequestTypeRow
              key={type.id ?? `new-${index}`}
              type={type}
              index={index}
              registry={registry.data ?? []}
              isRegistryLoading={registry.isLoading}
              onChange={(patch) =>
                setTypes((current) =>
                  current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
                )
              }
              onRemove={() =>
                setTypes((current) => current.filter((_, i) => i !== index))
              }
            />
          ))}
        </div>
      )}

      <DashedAddButton
        label="Add an action"
        onClick={() => setTypes((current) => [...current, emptyRequestType()])}
      />

      <p className="text-caption text-gray-500">
        Questions come from the{' '}
        <Link to="/admin/fields" className="text-primary hover:underline">
          Form fields
        </Link>{' '}
        registry — the same one the order form uses. Removing an action stops
        offering it; requests already raised under it stay readable.
      </p>

      {error ? (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate({ requestTypes: submittable })}
          className="btn btn-primary inline-flex h-11 items-center gap-2 rounded-input px-5 text-body disabled:opacity-60"
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : null}
          Save actions
        </button>
      </div>
    </DetailCard>
  );
}
