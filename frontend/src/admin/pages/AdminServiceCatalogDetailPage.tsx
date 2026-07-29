import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { AdminLayout } from '../components/AdminLayout';
import { DataErrorState } from '../components/DataErrorState';
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
   *
   * A failed region list still seeds — with no region rows — so the page renders
   * the rest of the service instead of animating a skeleton forever waiting for
   * a fetch that already failed. Saving is blocked for as long as it stays that
   * way (below), since a draft seeded from an empty region list would write
   * every region off.
   */
  const loadedService = service.data;
  const loadedRegions = regions.data;
  const regionsUnavailable = regions.isError;

  useEffect(() => {
    if (!loadedService) return;
    if (!loadedRegions && !regionsUnavailable) return;
    setDraft(detailDraftFromService(loadedService, loadedRegions ?? []));
    setShowErrors(false);
  }, [loadedService, loadedRegions, regionsUnavailable]);

  const errors = useMemo(
    () => (draft ? validateDetailDraft(draft) : {}),
    [draft],
  );
  const hasErrors = Object.keys(errors).length > 0;

  // Only surface messages after a save attempt — a form that flags every empty
  // field the moment it opens reads as broken rather than helpful.
  const visibleErrors = showErrors ? errors : {};

  const isDirty = useMemo(() => {
    if (!draft || !loadedService || (!loadedRegions && !regionsUnavailable))
      return false;
    const original = detailDraftFromService(loadedService, loadedRegions ?? []);
    // The drafts carry per-session React keys, which differ between two seeds of
    // the same data — compare the payloads instead, which is what would be sent.
    return (
      JSON.stringify(detailPayloadFromDraft(draft)) !==
      JSON.stringify(detailPayloadFromDraft(original))
    );
  }, [draft, loadedService, loadedRegions, regionsUnavailable]);

  // Save is off while the region list is missing: the payload carries every
  // region's setting, so writing one seeded from an empty list would switch this
  // service off in every jurisdiction it covers.
  const canSave = isDirty && !regionsUnavailable;

  const patch = (next: Partial<ServiceDetailDraft>) =>
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));

  const onSave = () => {
    if (!draft || !serviceId || updateService.isPending || regionsUnavailable)
      return;

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

  /*
   * A service that isn't there and a request that failed are different answers
   * and get different screens (Design.md). A 404 is the API saying the service
   * is gone — there is nothing to retry and the way out is the catalog. Anything
   * else is the fetch itself failing, which retrying can fix, so it gets a
   * `role="alert"` and a Try again rather than a claim the service was removed.
   */
  const isNotFound =
    service.isError &&
    service.error instanceof ApiError &&
    service.error.status === 404;

  if (service.isError) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <div className="w-full p-4 md:p-6 lg:p-content">
          <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
            <ServiceDetailHeader
              title={isNotFound ? 'Service not found' : 'Service unavailable'}
              backTo={CATALOG_ROUTE}
              canSave={false}
              isSaving={false}
              onSave={() => {}}
            />

            {isNotFound ? (
              <div className="flex w-full flex-col items-start gap-3 rounded-card border border-gray-200 bg-white p-card">
                <p className="text-body text-gray-500">
                  This service is no longer in the catalog. It may have been
                  removed.
                </p>
                <Link
                  to={CATALOG_ROUTE}
                  className="flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Back to the catalog
                </Link>
              </div>
            ) : (
              <DataErrorState
                title="Couldn't load this service"
                description="Nothing about this service loaded, so the catalog entry is unchanged and nothing here can be edited yet. Try again in a moment."
                onRetry={() => void service.refetch()}
                isRetrying={service.isFetching}
              />
            )}
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
                canSave={canSave}
                isSaving={updateService.isPending}
                onSave={onSave}
              />

              {/*
               * Why Save is dead, said where the admin can see it rather than
               * leaving a button that never enables (Design.md — a control
               * disabled for a fixable reason states the reason).
               */}
              {regionsUnavailable ? (
                <p
                  role="alert"
                  className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
                >
                  The region list didn&rsquo;t load, so this service
                  can&rsquo;t be saved yet — saving now would clear the regions
                  it&rsquo;s offered in. Retry the region list below, then save.
                </p>
              ) : null}

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
                isError={regionsUnavailable}
                isRetrying={regions.isFetching}
                onRetry={() => void regions.refetch()}
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
                isRegistryError={registry.isError}
                isRetryingRegistry={registry.isFetching}
                onRetryRegistry={() => void registry.refetch()}
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
                canSave={canSave}
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
      {['10rem', '17.5rem', '18.75rem', '20rem', '17.5rem'].map((height, index) => (
        <div
          key={index}
          style={{ height }}
          className="w-full animate-pulse rounded-card bg-gray-200"
        />
      ))}
    </div>
  );
}
