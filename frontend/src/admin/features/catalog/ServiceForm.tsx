import { useEffect, useState } from 'react';

import { ApiError } from '@/services/api';

import { FormDialog } from '../../components/FormDialog';
import {
  draftFromService,
  newServiceDraft,
  payloadFromDraft,
  validateServiceDraft,
} from '../../lib/catalog';
import type {
  CatalogServiceDetail,
  ServiceFormDraft,
  ServiceFormErrors,
  ServiceIconKey,
  ServiceRegion,
  ServiceWritePayload,
} from '../../types/catalog';
import { SERVICE_ICON_OPTIONS } from '../../types/catalog';
import { useFieldPicker } from '../fields/queries';
import { DetailFieldEditor } from './DetailFieldEditor';
import {
  Field,
  FormSection,
  SelectInput,
  TextArea,
  TextInput,
} from '../../components/FormControls';
import { PricingTierEditor } from './PricingTierEditor';
import { RegionPicker } from './RegionPicker';

/*
 * Add / manage a service — the one form behind both entry points, since adding
 * and editing write the same shape. It opens as a bottom sheet on mobile and a
 * centered modal from `md` up (the shell handles that); the fields below are
 * written once for both.
 *
 * The fields are taken from what the two apps actually read, not invented for
 * this screen:
 *   - Details — `iconKey`, `name`, `shortName`, `description`, `features`, and
 *     the footer line: everything the portal's Step 1 service card renders.
 *   - Regions — the table's "Regions supported" column.
 *   - Pricing — the tiers the "N pricing tiers" column counts.
 *   - Application questions — the per-service `detailFields` the portal's Step 2
 *     form renders, so a service's questions are admin-authored data.
 *
 * The draft is local and only lifted on Save, so an abandoned edit changes
 * nothing. Opening re-seeds it from the loaded service (or an empty draft when
 * adding), which is what makes a dismissed edit discardable.
 *
 * Validation runs client-side for the round trip, but the backend's Zod schema
 * is the real contract (AGENTS.md) — a rejected save surfaces the API's own
 * field errors rather than assuming the local check caught everything.
 */

type ServiceFormProps = {
  open: boolean;
  mode: 'create' | 'edit';
  service?: CatalogServiceDetail;
  isLoadingService?: boolean;
  regions: ServiceRegion[];
  isLoadingRegions?: boolean;
  // The region list failed to load — the picker says so rather than reading as
  // "no jurisdictions configured".
  isRegionsError?: boolean;
  isRetryingRegions?: boolean;
  onRetryRegions?: () => void;
  isSaving?: boolean;
  error?: unknown;
  onSubmit: (payload: ServiceWritePayload) => void;
  onClose: () => void;
};

export function ServiceForm({
  open,
  mode,
  service,
  isLoadingService,
  regions,
  isLoadingRegions,
  isRegionsError,
  isRetryingRegions,
  onRetryRegions,
  isSaving,
  error,
  onSubmit,
  onClose,
}: ServiceFormProps) {
  const [draft, setDraft] = useState<ServiceFormDraft>(newServiceDraft);
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  // Why the last press of the submit button did nothing. Field errors alone
  // aren't enough: the button is in the fixed footer and the control it is
  // complaining about is usually scrolled out of sight, so a blocked submit
  // reads as a dead button unless it is also reported down here.
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  // The field registry the Application-questions picker offers. Questions are
  // registered on the Form fields screen; this form only chooses among them.
  const registry = useFieldPicker();

  /*
   * Re-seed whenever the dialog opens, and again when the service detail
   * arrives — Manage opens before the fetch resolves, so the draft starts empty
   * and fills in once the record is there.
   */
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setBlockedMessage(null);
    setDraft(service ? draftFromService(service) : newServiceDraft());
  }, [open, service]);

  const setField = <K extends keyof ServiceFormDraft>(
    key: K,
    value: ServiceFormDraft[K],
  ) => {
    // The footer notice belongs to the press that was blocked; once the admin
    // edits anything it is stale, so it clears on the next keystroke.
    setBlockedMessage(null);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = () => {
    const nextErrors = validateServiceDraft(draft);
    setErrors(nextErrors);

    const blocker = firstError(nextErrors);
    if (blocker) {
      const count = Object.keys(nextErrors).length;
      setBlockedMessage(
        count === 1
          ? blocker.message
          : `${blocker.message} ${count} fields need attention.`,
      );
      revealError(blocker.anchorId);
      return;
    }

    setBlockedMessage(null);
    onSubmit(payloadFromDraft(draft));
  };

  // The API's own message when a save is rejected server-side.
  const submitError =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Could not save this service. Try again.'
        : null;

  /*
   * The local block wins: it is set by the press that just happened and cleared
   * by the next edit, so whenever it is set it is the newer news — a server
   * rejection still on screen is from a request that went out before it.
   */
  const footerError = blockedMessage ?? submitError;

  const isBusy = Boolean(isSaving);
  const showSkeleton = mode === 'edit' && isLoadingService && !service;

  return (
    <FormDialog
      open={open}
      title={mode === 'create' ? 'Add service' : 'Manage service'}
      description={
        mode === 'create'
          ? 'Define what this service includes, where it’s offered, and how it’s priced.'
          : draft.name || service?.name
      }
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3">
          {footerError ? (
            <p role="alert" className="text-caption text-error">
              {footerError}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="shrink-0 rounded-input px-4 py-3 text-body font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-text disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isBusy || showSkeleton}
              className="flex h-input flex-1 items-center justify-center rounded-input bg-primary text-body-lg font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 md:h-11 md:flex-none md:px-6"
            >
              {isBusy
                ? 'Saving…'
                : mode === 'create'
                  ? 'Add service'
                  : 'Save changes'}
            </button>
          </div>
        </div>
      }
    >
      {showSkeleton ? (
        <FormSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <FormSection
            title="Details"
            description="What the customer sees on the service card."
          >
            <div className="flex flex-col gap-4">
              <Field
                label="Service name"
                htmlFor="service-name"
                error={errors.name}
                required
              >
                <TextInput
                  id="service-name"
                  value={draft.name}
                  onChange={(event) => setField('name', event.target.value)}
                  placeholder="Company Formation — LLC, INC, LTD"
                  error={errors.name}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Short name"
                  htmlFor="service-short-name"
                  hint="Used where the full name won’t fit."
                >
                  <TextInput
                    id="service-short-name"
                    value={draft.shortName}
                    onChange={(event) =>
                      setField('shortName', event.target.value)
                    }
                    placeholder="Company Formation"
                  />
                </Field>

                <Field label="Icon" htmlFor="service-icon">
                  <SelectInput
                    id="service-icon"
                    value={draft.iconKey}
                    onChange={(event) =>
                      setField('iconKey', event.target.value as ServiceIconKey)
                    }
                  >
                    {SERVICE_ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>

              <Field
                label="Description"
                htmlFor="service-description"
                error={errors.description}
                required
              >
                <TextArea
                  id="service-description"
                  value={draft.description}
                  onChange={(event) =>
                    setField('description', event.target.value)
                  }
                  rows={3}
                  placeholder="Register a new company and receive the formation documents."
                  error={errors.description}
                />
              </Field>

              <Field
                label="Included features"
                htmlFor="service-features"
                hint="One per line. Listed as bullets on the service card."
              >
                <TextArea
                  id="service-features"
                  value={draft.features}
                  onChange={(event) => setField('features', event.target.value)}
                  rows={4}
                  placeholder={
                    'Name availability check\nRegistered agent for one year\nEIN application'
                  }
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Footer label"
                  htmlFor="service-footer-label"
                  hint="The meta line under the card."
                >
                  <TextInput
                    id="service-footer-label"
                    value={draft.footerLabel}
                    onChange={(event) =>
                      setField('footerLabel', event.target.value)
                    }
                    placeholder="COVERAGE"
                  />
                </Field>

                <Field
                  label="Footer chips"
                  htmlFor="service-footer-chips"
                  hint="Comma separated. Optional."
                >
                  <TextInput
                    id="service-footer-chips"
                    value={draft.footerChips}
                    onChange={(event) =>
                      setField('footerChips', event.target.value)
                    }
                    placeholder="Amazon, Shopify, eBay"
                  />
                </Field>
              </div>
            </div>
          </FormSection>

          <FormSection
            id={ERROR_ANCHORS.regions}
            title="Regions supported"
            description="Where this service can be ordered."
          >
            <RegionPicker
              regions={regions}
              selected={draft.regionCodes}
              onChange={(codes) => setField('regionCodes', codes)}
              error={errors.regionCodes}
              isLoading={isLoadingRegions}
              isError={isRegionsError}
              isRetrying={isRetryingRegions}
              onRetry={onRetryRegions}
            />
          </FormSection>

          <FormSection
            id={ERROR_ANCHORS.pricing}
            title="Pricing tiers"
            description="Each tier is one price point for this service."
          >
            <PricingTierEditor
              tiers={draft.pricingTiers}
              regions={regions}
              selectedRegionCodes={draft.regionCodes}
              errors={errors}
              onChange={(tiers) => setField('pricingTiers', tiers)}
            />
          </FormSection>

          <FormSection
            id={ERROR_ANCHORS.questions}
            title="Application questions"
            description="Pick from the registered fields. Manage the questions themselves on the Form fields screen."
          >
            <DetailFieldEditor
              fields={draft.detailFields}
              errors={errors}
              registry={registry.data ?? []}
              isRegistryLoading={registry.isLoading}
              onChange={(fields) => setField('detailFields', fields)}
            />
          </FormSection>

          <FormSection title="Availability">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setField('active', event.target.checked)}
                className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
              />
              Active &mdash; customers can order this service
            </label>
          </FormSection>
        </div>
      )}
    </FormDialog>
  );
}

/*
 * Where each error key lives in the form, in the order the controls appear.
 *
 * Validation keys are paths ('name', 'tiers.0.amount'); these resolve one to the
 * element that has to come into view for the message to make sense — the control
 * itself where there is one, otherwise the section holding the row that failed.
 */
const ERROR_ANCHORS = {
  regions: 'service-regions',
  pricing: 'service-pricing',
  questions: 'service-questions',
} as const;

const ANCHOR_ORDER: { matches: (key: string) => boolean; anchorId: string }[] = [
  { matches: (key) => key === 'name', anchorId: 'service-name' },
  { matches: (key) => key === 'description', anchorId: 'service-description' },
  { matches: (key) => key === 'regionCodes', anchorId: ERROR_ANCHORS.regions },
  { matches: (key) => key.startsWith('tiers.'), anchorId: ERROR_ANCHORS.pricing },
  {
    matches: (key) => key.startsWith('fields.'),
    anchorId: ERROR_ANCHORS.questions,
  },
];

// The first error in form order — the one worth naming in the footer and
// scrolling to, since fixing errors top-down is how the form is read.
function firstError(errors: ServiceFormErrors) {
  const entries = Object.entries(errors);
  if (entries.length === 0) return null;

  for (const anchor of ANCHOR_ORDER) {
    const hit = entries.find(([key]) => anchor.matches(key));
    if (hit) return { anchorId: anchor.anchorId, message: hit[1] };
  }

  // A key no anchor claims still has to be reported; there is just nowhere
  // specific to scroll to.
  return { anchorId: null, message: entries[0]![1] };
}

function revealError(anchorId: string | null) {
  if (!anchorId) return;

  const element = document.getElementById(anchorId);
  if (!element) return;

  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  // Focus only lands on a control; a section is scrolled to, not focused.
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    element.focus({ preventScroll: true });
  }
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-input w-full animate-pulse rounded-input bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
