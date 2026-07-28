import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { AdminLayout } from '../components/AdminLayout';
import {
  IncludedItemsCard,
  PricingTemplatesCard,
  RequestFormStepsCard,
  RequestTypesCard,
  ResultSchemaCard,
  ServiceAvailabilityCard,
  ServiceDescriptionCard,
  ServiceDetailFooter,
  ServiceDetailHeader,
  SupportedRegionsCard,
  useAdminCatalogRegions,
  useAdminCatalogService,
  useUpdateCatalogServiceDetail,
} from '../features/catalog';
import { useFieldPicker } from '../features/fields/queries';
import { useAdminShell } from '../hooks/useAdminShell';
import {
  detailDraftFromService,
  detailPayloadFromDraft,
  validateDetailDraft,
} from '../lib/catalog';
import type { ServiceDetailDraft } from '../types/catalog';
import { ApiError } from '@/services/api';

/*
 * Service catalog — one service in full. The staff screen for what a service
 * describes, includes, where it's offered, how it's priced, and what customers
 * are asked when they order it.
 *
 * The section order is the same at every width — header, description, what's
 * included, regions, pricing, request form, footer — so one tree covers all
 * three links. What changes is the chrome around it: mobile leads with a back
 * row instead of breadcrumbs and pins Save to a sticky bottom bar, while `md`
 * and up carry breadcrumbs, a round back button, and Save in both the header and
 * the inline footer.
 *
 * Every value on the page comes from `GET /v1/admin/catalog/services/:id` and
 * the region set from `/catalog/regions` (endpoints land later, AGENTS.md
 * two-apps sync rule) — no service data is hardcoded here. The draft is seeded
 * once the service and regions have both resolved, because a region row exists
 * for every jurisdiction, not just the ones this service already covers.
 *
 * Save is enabled only when the draft actually differs from what loaded, so the
 * button reflects whether there is anything to write.
 */

const CATALOG_ROUTE = '/admin/catalog';

export function AdminServiceCatalogDetailPage() {
  const { user, onLogout } = useAdminShell();
  const { serviceId = '' } = useParams<{ serviceId: string }>();

  const service = useAdminCatalogService(serviceId || null);
  const regions = useAdminCatalogRegions();
  // The field registry the request-form builder picks questions from.
  const registry = useFieldPicker();
  const updateService = useUpdateCatalogServiceDetail();

  const [draft, setDraft] = useState<ServiceDetailDraft | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  /*
   * Seed the draft once both queries have landed. Keyed on the service id and
   * the loaded records, so a refetch that returns the same data doesn't discard
   * edits in progress, but navigating to a different service re-seeds.
   */
  const loadedService = service.data;
  const loadedRegions = regions.data;

  useEffect(() => {
    if (!loadedService || !loadedRegions) return;
    setDraft(detailDraftFromService(loadedService, loadedRegions));
    setShowErrors(false);
  }, [loadedService, loadedRegions]);

  const errors = useMemo(
    () => (draft ? validateDetailDraft(draft) : {}),
    [draft],
  );
  const hasErrors = Object.keys(errors).length > 0;

  // Only surface messages after a save attempt — a form that flags every empty
  // field the moment it opens reads as broken rather than helpful.
  const visibleErrors = showErrors ? errors : {};

  const isDirty = useMemo(() => {
    if (!draft || !loadedService || !loadedRegions) return false;
    const original = detailDraftFromService(loadedService, loadedRegions);
    // The drafts carry per-session React keys, which differ between two seeds of
    // the same data — compare the payloads instead, which is what would be sent.
    return (
      JSON.stringify(detailPayloadFromDraft(draft)) !==
      JSON.stringify(detailPayloadFromDraft(original))
    );
  }, [draft, loadedService, loadedRegions]);

  const patch = (next: Partial<ServiceDetailDraft>) =>
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));

  const onSave = () => {
    if (!draft || !serviceId || updateService.isPending) return;

    if (hasErrors) {
      setShowErrors(true);
      return;
    }

    updateService.mutate({
      serviceId,
      payload: detailPayloadFromDraft(draft),
    });
  };

  const saveError = updateService.isError
    ? updateService.error instanceof ApiError
      ? updateService.error.message
      : 'Something went wrong saving this service. Please try again.'
    : null;

  const isLoading = service.isPending || regions.isPending || !draft;

  // A service that doesn't exist (or that the API refused) has nothing to edit —
  // say so rather than rendering an empty form over a failed fetch.
  if (service.isError) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <div className="w-full p-4 md:p-6 lg:p-content">
          <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
            <ServiceDetailHeader
              title="Service not found"
              backTo={CATALOG_ROUTE}
              canSave={false}
              isSaving={false}
              onSave={() => {}}
            />
            <p className="rounded-card border border-gray-200 bg-white p-card text-body text-gray-500">
              This service could not be loaded. It may have been removed from the
              catalog.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      {/* The mobile sticky footer overlays the page, so the bottom padding keeps
          the last card clear of it; `md` and up have no bar to clear. */}
      <div className="w-full p-4 pb-[5.5rem] md:p-6 md:pb-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6">
          {isLoading ? (
            <DetailSkeleton />
          ) : (
            <>
              <ServiceDetailHeader
                title={loadedService?.name ?? ''}
                backTo={CATALOG_ROUTE}
                canSave={isDirty}
                isSaving={updateService.isPending}
                onSave={onSave}
              />

              <ServiceAvailabilityCard
                active={draft.active}
                serviceName={loadedService?.name ?? ''}
                onChange={(active) => patch({ active })}
              />

              <ServiceDescriptionCard
                value={draft.description}
                error={visibleErrors.description}
                onChange={(description) => patch({ description })}
              />

              <IncludedItemsCard
                features={draft.features}
                errors={visibleErrors}
                onChange={(features) => patch({ features })}
              />

              <SupportedRegionsCard
                regions={loadedRegions ?? []}
                settings={draft.regions}
                error={visibleErrors.regions}
                onChange={(nextRegions) => patch({ regions: nextRegions })}
              />

              <PricingTemplatesCard
                tiers={draft.pricingTiers}
                regions={loadedRegions ?? []}
                errors={visibleErrors}
                onChange={(pricingTiers) => patch({ pricingTiers })}
              />

              <RequestFormStepsCard
                steps={draft.steps}
                errors={visibleErrors}
                registry={registry.data ?? []}
                isRegistryLoading={registry.isLoading}
                onChange={(steps) => patch({ steps })}
              />

              {/*
               * The delivery half. Both cards save through their own endpoints
               * rather than the page's shared draft below — what a service
               * delivers is a different decision from what it sells, made at a
               * different time, and folding them into one Save would make an
               * unrelated pricing edit republish every customer's page.
               *
               * They read `service.data` rather than `draft` for the same
               * reason: they are not part of that draft.
               */}
              <ResultSchemaCard
                serviceId={service.data.id}
                resultFields={service.data.resultFields}
                resultPageTitle={service.data.resultPageTitle}
                resultNoun={service.data.resultNoun}
              />

              <RequestTypesCard
                serviceId={service.data.id}
                requestTypes={service.data.requestTypes}
              />

              {showErrors && hasErrors ? (
                <p
                  role="alert"
                  className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
                >
                  Some fields need attention before this service can be saved.
                </p>
              ) : null}

              {saveError ? (
                <p
                  role="alert"
                  className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
                >
                  {saveError}
                </p>
              ) : null}

              {updateService.isSuccess && !isDirty ? (
                <p
                  role="status"
                  className="rounded-input border border-success/30 bg-success/5 px-4 py-3 text-small text-success"
                >
                  Changes saved.
                </p>
              ) : null}

              <ServiceDetailFooter
                cancelTo={CATALOG_ROUTE}
                canSave={isDirty}
                isSaving={updateService.isPending}
                onSave={onSave}
              />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6" aria-hidden="true">
      <div className="h-10 w-full max-w-[30rem] animate-pulse rounded-input bg-gray-200" />
      {[160, 280, 300, 320, 280].map((height, index) => (
        <div
          key={index}
          style={{ height }}
          className="w-full animate-pulse rounded-card bg-gray-200"
        />
      ))}
    </div>
  );
}
