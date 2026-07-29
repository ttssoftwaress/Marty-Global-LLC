import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Star, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ApiError } from '@/services/api';
import { moveItem } from '../../../lib/catalog';
import { useResultFieldPicker } from '../../result-fields/queries';
import {
  resultFieldTypeLabel,
  type ResultFieldDefinition,
  type ResultFieldRef,
} from '../../../types/delivery';
import { useUpdateResultSchema } from '../queries';
import { Field, TextInput } from '../../../components/FormControls';
import { DashedAddButton, DetailCard } from './DetailCard';
import { ResultFieldPicker } from './ResultFieldPicker';

/*
 * "What this service delivers" — the admin control over the customer's result
 * page for this service.
 *
 * The mirror of the Request-form card above it, pointed the other way: that one
 * defines what the customer FILLS IN, this defines what they GET BACK. Facts are
 * PICKED from the result registry, never authored here, for the same reason
 * questions are — it is what keeps value keys a closed set instead of whatever
 * an admin typed on a given service.
 *
 * Three per-service overrides live on the row, because all three are properties
 * of the USE rather than of the fact:
 *   - Required — blocks delivery until it is filled, so the customer is never
 *     told a filing is done and shown a blank page.
 *   - Title    — whose value names the record. Exactly one per service.
 *   - Column   — whether it appears in the customer's table.
 *
 * Saved on its own endpoint rather than through the page's shared draft, because
 * it is a different decision made at a different time: what a service sells is
 * settled when it is created, what it delivers once the team knows what the
 * filing produces.
 */

type ResultSchemaCardProps = {
  serviceId: string;
  resultFields: ResultFieldRef[];
  resultPageTitle?: string;
  resultNoun?: string;
};

/*
 * `field`, not `ref`: React reserves `ref` as a prop name, so passing the
 * reference under it would be intercepted as a DOM ref and never reach this
 * component.
 */
function PickedResultRow({
  field: fieldRef,
  definition,
  index,
  count,
  onChange,
  onRemove,
  onMove,
  onMakePrimary,
}: {
  field: ResultFieldRef;
  definition: ResultFieldDefinition | undefined;
  index: number;
  count: number;
  onChange: (patch: Partial<ResultFieldRef>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  onMakePrimary: () => void;
}) {
  const isPrimary = fieldRef.isPrimary ?? definition?.isPrimary ?? false;
  const showInList = fieldRef.showInList ?? definition?.showInList ?? false;

  return (
    <div
      className={`flex flex-col gap-3 rounded-card border bg-white p-3 ${
        definition ? 'border-gray-200' : 'border-error'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-medium text-text">
            {definition?.label ?? fieldRef.fieldKey}
          </span>
          <span className="truncate text-caption text-gray-500">
            {definition
              ? `${resultFieldTypeLabel(definition.type)} · ${definition.key}`
              : 'This field is no longer in the registry — remove it.'}
          </span>
        </div>

        <div className="flex shrink-0 items-center">
          {/* Reordering is keyboard-driven: no DnD library in the stack budget. */}
          <button
            type="button"
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            aria-label={`Move ${definition?.label ?? fieldRef.fieldKey} up`}
            className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronUp className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index + 1)}
            disabled={index === count - 1}
            aria-label={`Move ${definition?.label ?? fieldRef.fieldKey} down`}
            className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronDown className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${definition?.label ?? fieldRef.fieldKey}`}
            className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-error"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-caption text-gray-600">
          <input
            type="checkbox"
            checked={fieldRef.required ?? false}
            onChange={(event) => onChange({ required: event.target.checked })}
            className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
          />
          Required to deliver
        </label>

        {/* Radio-like: exactly one fact titles a record, so choosing this one
         * clears the others rather than toggling independently. */}
        <button
          type="button"
          onClick={onMakePrimary}
          className={`flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-medium transition-colors ${
            isPrimary
              ? 'bg-primary-light text-primary'
              : 'bg-gray-100 text-gray-500 hover:text-primary'
          }`}
        >
          <Star
            className="size-3.5"
            strokeWidth={2}
            fill={isPrimary ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
          {isPrimary ? 'Titles the record' : 'Make it the title'}
        </button>

        <label className="flex cursor-pointer items-center gap-2 text-caption text-gray-600">
          <input
            type="checkbox"
            checked={showInList || isPrimary}
            disabled={isPrimary}
            onChange={(event) => onChange({ showInList: event.target.checked })}
            className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)] disabled:opacity-60"
          />
          Show as a column
        </label>
      </div>
    </div>
  );
}

export function ResultSchemaCard({
  serviceId,
  resultFields,
  resultPageTitle,
  resultNoun,
}: ResultSchemaCardProps) {
  const [fields, setFields] = useState<ResultFieldRef[]>(resultFields);
  const [pageTitle, setPageTitle] = useState(resultPageTitle ?? '');
  const [noun, setNoun] = useState(resultNoun ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const addFactRef = useRef<HTMLButtonElement>(null);

  // Re-seed when the service loads or is saved elsewhere on the page.
  useEffect(() => {
    setFields(resultFields);
    setPageTitle(resultPageTitle ?? '');
    setNoun(resultNoun ?? '');
  }, [resultFields, resultPageTitle, resultNoun]);

  const registry = useResultFieldPicker();
  const save = useUpdateResultSchema(serviceId);

  const byKey = useMemo(
    () => new Map((registry.data ?? []).map((field) => [field.key, field])),
    [registry.data],
  );

  const update = (index: number, patch: Partial<ResultFieldRef>) =>
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );

  // Exactly one primary: setting one clears every other, which is the rule the
  // backend enforces on write and the resolver defends on read.
  const makePrimary = (index: number) =>
    setFields((current) =>
      current.map((field, i) => ({ ...field, isPrimary: i === index })),
    );

  const error =
    save.error instanceof ApiError
      ? save.error.message
      : save.isError
        ? 'Something went wrong saving the result schema.'
        : null;

  return (
    <DetailCard
      title="What this service delivers"
      description="The facts the customer sees once this service is complete. Staff fill these in to deliver it, and the customer gets a page listing every record."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Page title" hint="“My companies” — the heading on the customer’s page.">
          <TextInput
            value={pageTitle}
            onChange={setPageTitle}
            placeholder="My companies"
          />
        </Field>

        <Field label="Word for one record" hint="Used in counts and empty states.">
          <TextInput value={noun} onChange={setNoun} placeholder="company" />
        </Field>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-card border border-dashed border-gray-300 px-4 py-6 text-center text-body text-gray-500">
          This service delivers nothing yet, so it gets no customer page. Add the
          facts it returns below.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <PickedResultRow
              key={field.fieldKey}
              field={field}
              definition={byKey.get(field.fieldKey)}
              index={index}
              count={fields.length}
              onChange={(patch) => update(index, patch)}
              onRemove={() =>
                setFields((current) => current.filter((_, i) => i !== index))
              }
              onMove={(to) => setFields((current) => moveItem(current, index, to))}
              onMakePrimary={() => makePrimary(index)}
            />
          ))}
        </div>
      )}

      <ResultFieldPicker
        open={pickerOpen}
        fields={registry.data ?? []}
        isLoading={registry.isLoading}
        pickedKeys={fields.map((field) => field.fieldKey)}
        onPick={(definition) => {
          setFields((current) => [...current, { fieldKey: definition.key }]);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
        triggerRef={addFactRef}
      />

      {!pickerOpen ? (
        <DashedAddButton
          ref={addFactRef}
          label="Add a delivered fact"
          onClick={() => setPickerOpen(true)}
        />
      ) : null}

      <p className="text-caption text-gray-500">
        Facts are registered on the{' '}
        <Link to="/admin/fields" className="text-primary hover:underline">
          Form fields
        </Link>{' '}
        screen, under “Result fields”.
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
          onClick={() =>
            save.mutate({
              resultFields: fields,
              resultPageTitle: pageTitle.trim(),
              resultNoun: noun.trim(),
            })
          }
          className="btn btn-primary inline-flex h-11 items-center gap-2 rounded-input px-5 text-body disabled:opacity-60"
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : null}
          Save delivery schema
        </button>
      </div>
    </DetailCard>
  );
}
