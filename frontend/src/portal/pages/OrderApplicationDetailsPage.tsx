import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  AdditionalNotesCard,
  ApplicationFooterActions,
  OrderStepIndicator,
  SelectedServicesSummaryStrip,
  ServiceDetailsCard,
  SupportingDocumentsCard,
} from '../features/order-new-service';
import {
  useCreateOrder,
  useServiceCatalog,
} from '../features/order-new-service/queries';
import { usePortalShell } from '../hooks/usePortalShell';
import { ApiError } from '@/services/api';
import type {
  OrderApplicationDraft,
  OrderServiceCatalog,
  OrderableService,
} from '../types/order-new-service';

/*
 * Order a new service — Step 2: Application details.
 *
 * One responsive tree covers all three Figma links; Tailwind swaps the parts
 * that differ (2-col vs 1-col field grids, and the footer's desktop 3-across /
 * tablet note-above-buttons / mobile sticky-bar arrangements).
 *
 * The screen renders one ServiceDetailsCard per selected service, and each
 * card's fields come from that service's admin-defined `detailFields` schema —
 * so the form is data, matching Step 1's "the catalog is dynamic" contract.
 * Nothing about the two services in the design is hardcoded here.
 *
 * Selection flows from Step 1 via router `state` (an array of service ids).
 * Step 2 resolves those ids against the catalog (a prop until the endpoint
 * lands, same skeleton pattern as Step 1). A direct visit with no selection —
 * a refresh or deep link — has nothing to fill in, so it redirects back to
 * Step 1 rather than showing an empty form.
 */

const STEP_1_ROUTE = '/app/order';

type OrderApplicationLocationState = {
  serviceIds?: string[];
};

type OrderApplicationDetailsPageProps = {
  catalog?: OrderServiceCatalog;
  isLoading?: boolean;
};

function ApplicationSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6" aria-hidden="true">
      <div className="h-14 w-full max-w-[420px] animate-pulse rounded-input bg-gray-200" />
      <div className="h-12 w-full animate-pulse rounded-input bg-gray-200" />
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="h-64 w-full animate-pulse rounded-card bg-gray-200" />
      ))}
    </div>
  );
}

export function OrderApplicationDetailsPage({
  catalog: catalogProp,
  isLoading: isLoadingProp,
}: OrderApplicationDetailsPageProps) {
  const { user, onLogout } = usePortalShell();
  const navigate = useNavigate();
  const location = useLocation();

  // Catalog from the backend (prop override for tests); the create-order
  // mutation posts the assembled draft on submit.
  const catalogQuery = useServiceCatalog();
  const catalog = catalogProp ?? catalogQuery.data;
  const isLoading = isLoadingProp ?? catalogQuery.isLoading;
  const createOrder = useCreateOrder();

  const selectedIds = useMemo(() => {
    const state = location.state as OrderApplicationLocationState | null;
    return state?.serviceIds ?? [];
  }, [location.state]);

  // The catalog is the source of truth for a service's field schema; the ids
  // from Step 1 pick which of its services to show, in catalog order so the
  // sections read top-to-bottom the same way the Step 1 cards did.
  const selectedServices = useMemo<OrderableService[]>(() => {
    const services = catalog?.services ?? [];
    const chosen = new Set(selectedIds);
    return services.filter((service) => chosen.has(service.id));
  }, [catalog, selectedIds]);

  const [draft, setDraft] = useState<OrderApplicationDraft>({
    answersByService: {},
    documents: [],
    notes: '',
  });

  const setFieldValue = (serviceId: string, fieldName: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      answersByService: {
        ...prev.answersByService,
        [serviceId]: {
          ...prev.answersByService[serviceId],
          [fieldName]: value,
        },
      },
    }));
  };

  const setDocuments = (documents: File[]) =>
    setDraft((prev) => ({ ...prev, documents }));

  const setNotes = (notes: string) => setDraft((prev) => ({ ...prev, notes }));

  // Submit unlocks once every required field on every selected service has a
  // value. Optional fields, documents, and notes never gate it.
  const canSubmit = useMemo(() => {
    return selectedServices.every((service) =>
      (service.detailFields ?? [])
        .filter((field) => field.required)
        .every((field) => {
          const value = draft.answersByService[service.id]?.[field.name];
          return typeof value === 'string' && value.trim().length > 0;
        }),
    );
  }, [selectedServices, draft.answersByService]);

  const goToStep1 = () => navigate(STEP_1_ROUTE);

  const onSubmit = () => {
    if (!canSubmit || createOrder.isPending) return;

    // POST the assembled draft. The endpoint returns the OrderConfirmation
    // (reference, submitted date, services, email — the backend owns those,
    // AGENTS.md); Step 3 renders only that real data, so it's carried there via
    // router state exactly the way Step 1 handed the selection to Step 2.
    // Documents are deferred (R2 upload is a later task), so only answers +
    // notes are sent for now.
    createOrder.mutate(
      {
        serviceIds: selectedServices.map((service) => service.id),
        answersByService: draft.answersByService,
        notes: draft.notes.trim() || undefined,
      },
      {
        onSuccess: (confirmation) => {
          navigate('/app/order/submitted', { state: { confirmation } });
        },
      },
    );
  };

  const submitError = createOrder.isError
    ? createOrder.error instanceof ApiError
      ? createOrder.error.message
      : 'Something went wrong submitting your application. Please try again.'
    : null;

  const showSkeleton = isLoading || !catalog;

  // A direct visit with no selection (a refresh or deep link) has nothing to
  // fill in — send the customer back to Step 1 to choose. Only redirect once the
  // catalog has resolved, so a still-loading screen isn't mistaken for "empty".
  const noSelection = !showSkeleton && selectedServices.length === 0;
  useEffect(() => {
    if (noSelection) navigate(STEP_1_ROUTE, { replace: true });
  }, [noSelection, navigate]);

  if (noSelection) return null;

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 md:gap-6 lg:gap-8">
          {showSkeleton ? (
            <ApplicationSkeleton />
          ) : (
            <>
              {/* Breadcrumb — md+ only; mobile leads with the progress bar. */}
              <p className="hidden text-caption font-medium uppercase tracking-[0.6px] text-gray-500 md:block">
                Dashboard / Order new service / Application details
              </p>

              <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-1 lg:max-w-[640px]">
                  <h1 className="text-h4 font-semibold text-text md:text-[28px] md:leading-[36px] lg:text-h3">
                    Application details
                  </h1>
                  <p className="text-body text-text-secondary">
                    Fill in the details for each selected service.
                  </p>
                </div>

                <OrderStepIndicator currentStep={2} />
              </header>

              <SelectedServicesSummaryStrip
                selected={selectedServices}
                changeSelectionHref={STEP_1_ROUTE}
              />

              <div className="flex flex-col gap-5 md:gap-6">
                {selectedServices.map((service) => (
                  <ServiceDetailsCard
                    key={service.id}
                    service={service}
                    answers={draft.answersByService[service.id] ?? {}}
                    onFieldChange={(fieldName, value) =>
                      setFieldValue(service.id, fieldName, value)
                    }
                  />
                ))}

                <SupportingDocumentsCard
                  files={draft.documents}
                  onChange={setDocuments}
                />

                <AdditionalNotesCard value={draft.notes} onChange={setNotes} />
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
                >
                  {submitError}
                </p>
              )}

              <ApplicationFooterActions
                onBack={goToStep1}
                onSubmit={onSubmit}
                canSubmit={canSubmit}
                isSubmitting={createOrder.isPending}
              />
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
