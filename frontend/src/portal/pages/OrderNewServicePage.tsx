import { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  OrderStepIndicator,
  OrderStickyBar,
  SelectedServicesRail,
  ServiceCardGrid,
} from '../features/order-new-service';
import { useServiceCatalog } from '../features/order-new-service/queries';
import { usePortalShell } from '../hooks/usePortalShell';
import type { OrderServiceCatalog } from '../types/order-new-service';

/*
 * Order a new service — Step 1: Select services.
 *
 * One responsive tree covers all three Figma links; Tailwind swaps the parts
 * that differ. The catalog of services is admin-defined and comes from the
 * backend, so the grid renders however many services arrive — nothing is
 * hardcoded. Until the catalog endpoint lands, the screen renders a skeleton
 * (same pattern as OrdersPage).
 *
 * Layout by breakpoint (matching the links):
 *   - mobile:  back-chevron header + progress bar, 1-col cards, sticky bottom bar
 *              ("N selected" + Continue).
 *   - tablet:  breadcrumb + numbered steps, 2-col cards, sticky bottom bar (chips
 *              + quote note + Continue).
 *   - desktop: breadcrumb + numbered steps, 2-col cards beside a 380px summary
 *              rail (chips + quote note + Continue).
 *
 * Selection is client-only UI state (a Set of service ids). Continue will carry
 * the chosen ids into Step 2 (Application details) once that screen exists; for
 * now it's wired to the same state so the flow is ready.
 */

type OrderNewServicePageProps = {
  catalog?: OrderServiceCatalog;
  isLoading?: boolean;
};

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:gap-5" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-[240px] w-full animate-pulse rounded-card bg-gray-200 md:h-[260px]"
        />
      ))}
    </div>
  );
}

export function OrderNewServicePage({
  catalog: catalogProp,
  isLoading: isLoadingProp,
}: OrderNewServicePageProps) {
  const { user, onLogout } = usePortalShell();
  const navigate = useNavigate();

  // The catalog comes from the backend; a prop override lets tests supply one
  // directly. The prop wins when present so the page stays presentational.
  const catalogQuery = useServiceCatalog();
  const catalog = catalogProp ?? catalogQuery.data;
  const isLoading = isLoadingProp ?? catalogQuery.isLoading;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const services = catalog?.services ?? [];
  const showSkeleton = isLoading || !catalog;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const remove = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Selected services in catalog order, so the rail/bar chips read top-to-bottom
  // the same way the cards do.
  const selectedServices = useMemo(
    () => services.filter((service) => selectedIds.has(service.id)),
    [services, selectedIds],
  );

  const onContinue = () => {
    if (selectedServices.length === 0) return;
    // Hand the chosen service ids to Step 2 (Application details) via router
    // state; that screen resolves them against the catalog to render one detail
    // section per service.
    navigate('/app/order/details', {
      state: { serviceIds: selectedServices.map((service) => service.id) },
    });
  };

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      {/* Content scrolls; the mobile/tablet action bar is a sibling that sticks
          to the bottom of this same flow. `flex-1` pushes the bar down so it sits
          at the viewport bottom even when the cards are short. */}
      <div className="flex min-h-full flex-col">
      <div className="w-full flex-1 p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 md:gap-6 lg:gap-8">
          {/* Breadcrumb — md+ only; mobile uses a back chevron in the title row. */}
          <p className="hidden text-caption font-medium uppercase tracking-[0.6px] text-gray-500 md:block">
            Dashboard / Order new service
          </p>

          <header className="flex flex-col gap-4 md:gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 lg:max-w-[640px]">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  aria-label="Go back"
                  className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-input text-text hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
                >
                  <ChevronLeft className="size-5" strokeWidth={2} aria-hidden="true" />
                </button>
                <h1 className="text-h4 font-semibold text-text md:text-[28px] md:leading-[36px] lg:text-h3">
                  Order new service
                </h1>
              </div>
              <p className="text-body text-text-secondary">
                Select one or more services — you can order several in a single
                application.
              </p>
            </div>

            {/* Step indicator: numbered pills sit beside the title on desktop,
                below it on tablet; the mobile progress bar renders in flow. */}
            <OrderStepIndicator currentStep={1} />
          </header>

          {showSkeleton ? (
            <CatalogSkeleton />
          ) : (
            <div className="flex items-start gap-6">
              <div className="min-w-0 flex-1">
                <ServiceCardGrid
                  services={services}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                />
              </div>

              <SelectedServicesRail
                selected={selectedServices}
                onRemove={remove}
                onContinue={onContinue}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile + tablet action bar — a sibling of the content so it spans the
          workspace width and pins to the bottom while the cards scroll. */}
      {!showSkeleton && (
        <OrderStickyBar
          selected={selectedServices}
          onRemove={remove}
          onContinue={onContinue}
        />
      )}
      </div>
    </PortalLayout>
  );
}
