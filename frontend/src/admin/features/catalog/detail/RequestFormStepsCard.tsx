import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';

import {
  dependencyIssues,
  emptyStepDraft,
  moveItem,
  pickedFieldChain,
} from '../../../lib/catalog';
import type {
  ServiceFieldDraft,
  ServiceFormErrors,
  ServiceFormStepDraft,
} from '../../../types/catalog';
import type { FieldDefinition } from '../../../types/fields';
import { FieldPicker } from '../FieldPicker';
import { PickedFieldRow } from '../PickedFieldRow';
import { Field, TextInput } from '../../../components/FormControls';
import { DashedAddButton, DetailCard } from './DetailCard';

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
 * steps, each holding the registered questions it asks. The portal renders one
 * screen per step and gates Continue on that step's required fields, so adding a
 * step here changes the customer's flow with no deploy in either app.
 *
 * Questions are PICKED from the field registry, never authored here. What a
 * question is — its key, label, control type, choices, upload settings — lives on
 * the Form fields screen; a step records only which registered questions it asks
 * and whether each is required on this service. That is what keeps answer keys a
 * closed set instead of whatever an admin typed on a given service, and what
 * makes the customer's merged master form exact.
 *
 * A question may appear only once across the whole service, not merely once per
 * step, because answers land in one flat map per service.
 *
 * No registered field collects money or card data, by design (AGENTS.md) — the
 * backend resolves amounts and we never collect card data anywhere.
 */

type RequestFormStepsCardProps = {
  steps: ServiceFormStepDraft[];
  errors: ServiceFormErrors;
  // The live registry the picker offers.
  registry: FieldDefinition[];
  isRegistryLoading: boolean;
  isRegistryError?: boolean;
  isRetryingRegistry?: boolean;
  onRetryRegistry?: () => void;
  onChange: (steps: ServiceFormStepDraft[]) => void;
};

export function RequestFormStepsCard({
  steps,
  errors,
  registry,
  isRegistryLoading,
  isRegistryError = false,
  isRetryingRegistry = false,
  onRetryRegistry,
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

  const registryByKey = useMemo(
    () => new Map(registry.map((definition) => [definition.key, definition])),
    [registry],
  );

  // Every question the service already asks, across all steps — the picker
  // disables these so the same field can't land on two screens.
  const pickedKeys = useMemo(
    () => steps.flatMap((step) => step.fields.map((field) => field.fieldKey)),
    [steps],
  );

  /*
   * Dependent dropdowns arranged wrongly. Judged over the whole service in step
   * order, because that is the sequence the customer meets the screens in: a
   * chain split across two steps is fine as long as the parent's step comes
   * first, and the same chain reversed is not.
   */
  const issues = useMemo(
    () => dependencyIssues(pickedKeys, registry),
    [pickedKeys, registry],
  );

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
                registry={registry}
                registryByKey={registryByKey}
                isRegistryLoading={isRegistryLoading}
                isRegistryError={isRegistryError}
                isRetryingRegistry={isRetryingRegistry}
                onRetryRegistry={onRetryRegistry}
                pickedKeys={pickedKeys}
                dependencyIssues={issues}
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
  registry,
  registryByKey,
  isRegistryLoading,
  isRegistryError,
  isRetryingRegistry,
  onRetryRegistry,
  pickedKeys,
  dependencyIssues: issues,
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
  registry: FieldDefinition[];
  registryByKey: Map<string, FieldDefinition>;
  isRegistryLoading: boolean;
  isRegistryError: boolean;
  isRetryingRegistry: boolean;
  onRetryRegistry?: () => void;
  pickedKeys: string[];
  // Keyed by field key, service-wide — a parent may sit on another step.
  dependencyIssues: Record<string, string>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onChange: (patch: Partial<ServiceFormStepDraft>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  const prefix = `steps.${index}`;
  const titleError = errors[`${prefix}.title`];

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const addQuestionRef = useRef<HTMLButtonElement>(null);

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
          {step.fields.length === 0 && !isPickerOpen ? (
            <p className="text-body text-gray-500">
              This step has no questions yet — customers would see an empty screen.
            </p>
          ) : null}

          {step.fields.map((field, fieldIndex) => (
            <PickedFieldRow
              key={field.key}
              field={field}
              definition={registryByKey.get(field.fieldKey)}
              index={fieldIndex}
              fieldCount={step.fields.length}
              error={errors[`steps.${index}.fields.${fieldIndex}.fieldKey`]}
              {...(issues[field.fieldKey]
                ? { dependencyIssue: issues[field.fieldKey] }
                : {})}
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
          ))}

          <FieldPicker
            open={isPickerOpen}
            fields={registry}
            isLoading={isRegistryLoading}
            isError={isRegistryError}
            isRetrying={isRetryingRegistry}
            onRetry={onRetryRegistry}
            // Every key the whole service already asks, not just this step:
            // answers land in one flat map per service, so a field picked on
            // another step would collide here.
            pickedKeys={pickedKeys}
            onPick={(definition) => {
              // Any parent the SERVICE doesn't ask yet comes along above it —
              // `pickedKeys` is service-wide, so one already sitting on an
              // earlier step is left where it is.
              setFields([
                ...step.fields,
                ...pickedFieldChain(definition.key, registry, pickedKeys),
              ]);
              setIsPickerOpen(false);
            }}
            onClose={() => setIsPickerOpen(false)}
            triggerRef={addQuestionRef}
          />

          {!isPickerOpen && (
            <button
              ref={addQuestionRef}
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="flex h-10 items-center justify-center gap-2 self-start rounded-control border border-dashed border-gray-300 bg-white px-4 text-body font-medium text-primary transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Add question
            </button>
          )}
        </div>
      )}
    </li>
  );
}
