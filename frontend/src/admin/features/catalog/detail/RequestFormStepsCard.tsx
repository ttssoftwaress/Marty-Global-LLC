import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  emptyFieldDraft,
  emptyStepDraft,
  moveItem,
  slugify,
} from '../../../lib/catalog';
import type {
  ServiceFieldDraft,
  ServiceFormErrors,
  ServiceFormStepDraft,
} from '../../../types/catalog';
import { SERVICE_FIELD_TYPE_OPTIONS } from '../../../types/catalog';
import { Field, SelectInput, TextArea, TextInput } from '../FormControls';
import { DashedAddButton, DetailCard } from './DetailCard';
import { ToggleSwitch } from './ToggleSwitch';

/*
 * "Request form & steps" — the admin control over what a customer fills in to
 * order this service, and how many screens they fill it in across.
 *
 * This card has no counterpart in the Figma links, which cover only the four
 * cards above it. It is built to the written brief ("this defines what form
 * fields there are and how many steps there are in a service request"), in the
 * same card language as the designed sections, and is logged as a deviation.
 *
 * The shape it writes is the contract the portal's order flow reads: a service's
 * steps, each holding its own fields. The portal renders one screen per step and
 * gates Continue on that step's required fields, so adding a step here changes
 * the customer's flow with no deploy in either app — which is the whole point of
 * the catalog being data.
 *
 * A field key (`name`) is what an answer is stored under. It is derived from the
 * label while a field is new and left alone once saved: renaming a live key would
 * orphan every answer already recorded against it. Keys are unique across the
 * whole service, not per step, because answers land in one flat map per service.
 *
 * No field type collects money or card data, by design (AGENTS.md) — the backend
 * resolves amounts and Stripe holds the card, so an admin-authored form must
 * never be able to ask for either.
 */

type RequestFormStepsCardProps = {
  steps: ServiceFormStepDraft[];
  errors: ServiceFormErrors;
  onChange: (steps: ServiceFormStepDraft[]) => void;
};

export function RequestFormStepsCard({
  steps,
  errors,
  onChange,
}: RequestFormStepsCardProps) {
  // Every step starts open on a fresh load; collapsing is per-session state that
  // only keeps a long form navigable.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const updateStep = (
    index: number,
    patch: Partial<ServiceFormStepDraft>,
  ) => {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const addStep = () => onChange([...steps, emptyStepDraft()]);

  const totalFields = steps.reduce((sum, step) => sum + step.fields.length, 0);

  return (
    <DetailCard
      title="Request form & steps"
      description="What customers fill in when they order this service. Each step is one screen in the order flow — fields marked required must be answered before the customer can continue."
    >
      {steps.length === 0 ? (
        <p className="rounded-card border border-dashed border-gray-300 px-4 py-5 text-center text-body text-gray-500">
          No steps yet. Customers ordering this service will only supply the
          application-wide notes and documents.
        </p>
      ) : (
        <>
          <p className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
            {steps.length} step{steps.length === 1 ? '' : 's'} · {totalFields}{' '}
            field{totalFields === 1 ? '' : 's'}
          </p>

          <ol className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <StepRow
                key={step.key}
                step={step}
                index={index}
                stepCount={steps.length}
                errors={errors}
                collapsed={collapsed.has(step.key)}
                onToggleCollapsed={() => toggleCollapsed(step.key)}
                onChange={(patch) => updateStep(index, patch)}
                onRemove={() => removeStep(index)}
                onMove={(to) => onChange(moveItem(steps, index, to))}
              />
            ))}
          </ol>
        </>
      )}

      <DashedAddButton label="Add step" onClick={addStep} />
    </DetailCard>
  );
}

function StepRow({
  step,
  index,
  stepCount,
  errors,
  collapsed,
  onToggleCollapsed,
  onChange,
  onRemove,
  onMove,
}: {
  step: ServiceFormStepDraft;
  index: number;
  stepCount: number;
  errors: ServiceFormErrors;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onChange: (patch: Partial<ServiceFormStepDraft>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  const prefix = `steps.${index}`;
  const titleError = errors[`${prefix}.title`];

  const setFields = (fields: ServiceFieldDraft[]) => onChange({ fields });

  const hasFieldError = Object.keys(errors).some((key) =>
    key.startsWith(`${prefix}.fields.`),
  );

  return (
    <li
      className={`flex flex-col gap-4 rounded-card border bg-gray-50 p-3 md:p-4 ${
        titleError || hasFieldError ? 'border-error' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-2 md:gap-3">
        {/* Reordering is keyboard-driven for the same reason as the included
            list: no DnD library in the stack budget. Explicit up/down buttons
            sit beside the grip so the affordance is discoverable by pointer too. */}
        <div className="flex shrink-0 flex-col items-center gap-0.5 pt-2">
          <GripVertical
            className="size-5 text-gray-400"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => onMove(index - 1)}
              disabled={index === 0}
              aria-label={`Move step ${index + 1} up`}
              className="flex size-5 items-center justify-center rounded text-gray-400 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronUp className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMove(index + 1)}
              disabled={index === stepCount - 1}
              aria-label={`Move step ${index + 1} down`}
              className="flex size-5 items-center justify-center rounded text-gray-400 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronDown className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
              Step {index + 1}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-expanded={!collapsed}
                className="rounded px-2 py-1 text-caption font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {collapsed
                  ? `Expand (${step.fields.length})`
                  : 'Collapse'}
              </button>

              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove step ${index + 1}`}
                className="flex size-8 items-center justify-center rounded-control text-gray-400 transition-colors hover:bg-gray-200 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Step title"
              htmlFor={`${step.key}-title`}
              error={titleError}
              required
            >
              <TextInput
                id={`${step.key}-title`}
                value={step.title}
                onChange={(event) => onChange({ title: event.target.value })}
                placeholder="Entity details"
                error={titleError}
              />
            </Field>

            <Field
              label="Step description"
              htmlFor={`${step.key}-description`}
              hint="Shown under the step title in the order flow."
            >
              <TextInput
                id={`${step.key}-description`}
                value={step.description}
                onChange={(event) =>
                  onChange({ description: event.target.value })
                }
                placeholder="Tell us about the company you want to form."
              />
            </Field>
          </div>
        </div>
      </div>

      {collapsed ? null : (
        <div className="flex flex-col gap-3 border-t border-gray-200 pt-4">
          {step.fields.length === 0 ? (
            <p className="text-body text-gray-500">
              This step has no fields yet — customers would see an empty screen.
            </p>
          ) : (
            step.fields.map((field, fieldIndex) => (
              <FieldRow
                key={field.key}
                field={field}
                stepIndex={index}
                index={fieldIndex}
                fieldCount={step.fields.length}
                errors={errors}
                onChange={(patch) =>
                  setFields(
                    step.fields.map((item, i) =>
                      i === fieldIndex ? { ...item, ...patch } : item,
                    ),
                  )
                }
                onRemove={() =>
                  setFields(step.fields.filter((_, i) => i !== fieldIndex))
                }
                onMove={(to) => setFields(moveItem(step.fields, fieldIndex, to))}
              />
            ))
          )}

          <button
            type="button"
            onClick={() => setFields([...step.fields, emptyFieldDraft()])}
            className="flex h-10 items-center justify-center gap-2 self-start rounded-control border border-dashed border-gray-300 bg-white px-4 text-body font-medium text-primary transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Add field
          </button>
        </div>
      )}
    </li>
  );
}

function FieldRow({
  field,
  stepIndex,
  index,
  fieldCount,
  errors,
  onChange,
  onRemove,
  onMove,
}: {
  field: ServiceFieldDraft;
  stepIndex: number;
  index: number;
  fieldCount: number;
  errors: ServiceFormErrors;
  onChange: (patch: Partial<ServiceFieldDraft>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  const prefix = `steps.${stepIndex}.fields.${index}`;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
          Field {index + 1}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            aria-label={`Move field ${index + 1} up`}
            className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronUp className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index + 1)}
            disabled={index === fieldCount - 1}
            aria-label={`Move field ${index + 1} down`}
            className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronDown className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove field ${index + 1}`}
            className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field
          label="Label"
          htmlFor={`${field.key}-label`}
          error={errors[`${prefix}.label`]}
          required
        >
          <TextInput
            id={`${field.key}-label`}
            value={field.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="Preferred company name"
            error={errors[`${prefix}.label`]}
          />
        </Field>

        <Field label="Type" htmlFor={`${field.key}-type`}>
          <SelectInput
            id={`${field.key}-type`}
            value={field.type}
            onChange={(event) =>
              onChange({ type: event.target.value as ServiceFieldDraft['type'] })
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
          htmlFor={`${field.key}-name`}
          error={errors[`${prefix}.name`]}
          hint="Leave blank to derive it from the label."
        >
          <TextInput
            id={`${field.key}-name`}
            value={field.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder={slugify(field.label) || 'company-name'}
            error={errors[`${prefix}.name`]}
          />
        </Field>

        <Field label="Placeholder" htmlFor={`${field.key}-placeholder`}>
          <TextInput
            id={`${field.key}-placeholder`}
            value={field.placeholder}
            onChange={(event) => onChange({ placeholder: event.target.value })}
            placeholder="Shown inside the empty input"
          />
        </Field>
      </div>

      {field.type === 'select' ? (
        <Field
          label="Choices"
          htmlFor={`${field.key}-options`}
          error={errors[`${prefix}.options`]}
          hint="One per line. Use value|Label to set a stored value."
          required
        >
          <TextArea
            id={`${field.key}-options`}
            value={field.options}
            onChange={(event) => onChange({ options: event.target.value })}
            rows={4}
            placeholder={'Delaware\nWyoming\nnew-mexico|New Mexico'}
            error={errors[`${prefix}.options`]}
          />
        </Field>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
        <div className="flex flex-col">
          <span className="text-form-label text-text">Required</span>
          <span className="text-caption text-gray-500">
            Customers must answer this before continuing.
          </span>
        </div>

        <ToggleSwitch
          checked={field.required}
          onChange={(next) => onChange({ required: next })}
          label={`Make ${field.label || `field ${index + 1}`} required`}
        />
      </div>
    </div>
  );
}
