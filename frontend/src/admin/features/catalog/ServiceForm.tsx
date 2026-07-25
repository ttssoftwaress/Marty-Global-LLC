import { useEffect, useState } from 'react';

import { ApiError } from '@/services/api';

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
import { DetailFieldEditor } from './DetailFieldEditor';
import {
  Field,
  FormSection,
  SelectInput,
  TextArea,
  TextInput,
} from './FormControls';
import { PricingTierEditor } from './PricingTierEditor';
import { RegionPicker } from './RegionPicker';
import { ServiceFormDialog } from './ServiceFormDialog';

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
  isSaving,
  error,
  onSubmit,
  onClose,
}: ServiceFormProps) {
  const [draft, setDraft] = useState<ServiceFormDraft>(newServiceDraft);
  const [errors, setErrors] = useState<ServiceFormErrors>({});

  /*
   * Re-seed whenever the dialog opens, and again when the service detail
   * arrives — Manage opens before the fetch resolves, so the draft starts empty
   * and fills in once the record is there.
   */
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDraft(service ? draftFromService(service) : newServiceDraft());
  }, [open, service]);

  const setField = <K extends keyof ServiceFormDraft>(
    key: K,
    value: ServiceFormDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const handleSubmit = () => {
    const nextErrors = validateServiceDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit(payloadFromDraft(draft));
  };

  // The API's own message when a save is rejected server-side.
  const submitError =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Could not save this service. Try again.'
        : null;

  const isBusy = Boolean(isSaving);
  const showSkeleton = mode === 'edit' && isLoadingService && !service;

  return (
    <ServiceFormDialog
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
          {submitError ? (
            <p role="alert" className="text-caption text-error">
              {submitError}
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
            title="Regions supported"
            description="Where this service can be ordered."
          >
            <RegionPicker
              regions={regions}
              selected={draft.regionCodes}
              onChange={(codes) => setField('regionCodes', codes)}
              error={errors.regionCodes}
              isLoading={isLoadingRegions}
            />
          </FormSection>

          <FormSection
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
            title="Application questions"
            description="What the customer is asked when ordering this service."
          >
            <DetailFieldEditor
              fields={draft.detailFields}
              errors={errors}
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
    </ServiceFormDialog>
  );
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
