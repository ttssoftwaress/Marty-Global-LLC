import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AdminLayout } from '../components/AdminLayout';
import {
  CatalogCardList,
  CatalogEmptyState,
  CatalogHeader,
  CatalogTable,
  ServiceForm,
  useAdminCatalogRegions,
  useAdminCatalogServices,
  useCreateCatalogService,
  useDeleteCatalogService,
} from '../features/catalog';
import { useAdminShell } from '../hooks/useAdminShell';
import type { CatalogServiceRow, ServiceWritePayload } from '../types/catalog';
import { ApiError } from '@/services/api';

/*
 * Service catalog & pricing — the staff screen for what each service includes,
 * where it's offered, and how it's priced.
 *
 * The page is one section at every width, so a single tree covers all three
 * links; what changes is how the list renders. `md` and up show the table inside
 * a bordered card (tablet folding the updated date into the pricing cell,
 * desktop giving it its own column); mobile shows a card stack on the page
 * background, which is what the mobile link draws.
 *
 * Every row comes from the API — nothing about the catalog is hardcoded here.
 * Two queries back the screen (endpoints land later, AGENTS.md two-apps sync
 * rule): the cursor-paginated service list, and the region set the form offers.
 * A third loads one service in full, only once Manage is pressed.
 *
 * Add and Manage open the same form, since both write the same shape — the
 * difference is whether a service id is being edited. It rises from the bottom
 * as a sheet on mobile and centres as a modal from `md` up.
 */

export function AdminServiceCatalogPage() {
  const { user, onLogout } = useAdminShell();

  const navigate = useNavigate();

  const services = useAdminCatalogServices();
  const regions = useAdminCatalogRegions();

  // The modal now only adds a service — editing happens on the service's own
  // screen — so its state is a single open/closed flag.
  const [isAddOpen, setIsAddOpen] = useState(false);

  const createService = useCreateCatalogService();
  const deleteService = useDeleteCatalogService();

  // Which row is mid-delete, so only that row's button says "Deleting…".
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rows = useMemo<CatalogServiceRow[]>(
    () => services.data?.pages.flatMap((page) => page.rows) ?? [],
    [services.data],
  );

  const openCreate = () => {
    createService.reset();
    setIsAddOpen(true);
  };

  /*
   * Manage opens the service's own screen rather than the modal. The full-page
   * editor is where a service's description, inclusions, regions, pricing, and
   * request form are edited — the modal stays for adding a service, where only
   * the identifying fields are needed to create the row.
   */
  const openManage = (row: CatalogServiceRow) => {
    navigate(`/admin/catalog/${row.id}`);
  };

  const closeForm = () => setIsAddOpen(false);

  /*
   * Delete only reaches here for a row the API marked `canDelete`, and the
   * endpoint re-checks it. A service that has been ordered is refused with a
   * message pointing at the alternative — turning it off, which lives on the
   * service's own screen — so the failure is surfaced rather than swallowed.
   */
  const handleDelete = (row: CatalogServiceRow) => {
    if (deleteService.isPending) return;
    setDeletingId(row.id);
    deleteService.mutate(row.id, { onSettled: () => setDeletingId(null) });
  };

  const deleteError = deleteService.isError
    ? deleteService.error instanceof ApiError
      ? deleteService.error.message
      : 'Something went wrong deleting this service. Please try again.'
    : null;

  /*
   * A new service is created with its identifying fields, then opened on its own
   * screen so the rest — inclusions, regions, pricing, and the request form —
   * are filled in where there is room for them.
   */
  const handleSubmit = (payload: ServiceWritePayload) => {
    createService.mutate(payload, {
      onSuccess: (service) => {
        closeForm();
        navigate(`/admin/catalog/${service.id}`);
      },
    });
  };

  const isLoading = services.isPending;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6 lg:gap-8">
          <CatalogHeader onAddService={openCreate} />

          {deleteError ? (
            <p
              role="alert"
              className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
            >
              {deleteError}
            </p>
          ) : null}

          {isLoading ? (
            <CatalogSkeleton />
          ) : isEmpty ? (
            <div className="w-full rounded-card border border-gray-200 bg-white md:rounded-table md:shadow-sm-elevation">
              <CatalogEmptyState onAddService={openCreate} />
            </div>
          ) : (
            <>
              {/* Mobile — cards on the page background, no surrounding frame. */}
              <CatalogCardList
                rows={rows}
                onManage={openManage}
                onDelete={handleDelete}
                deletingId={deletingId}
              />

              {/* Tablet & desktop — the table in its own card. */}
              <div className="hidden w-full overflow-hidden rounded-table border border-gray-200 bg-white shadow-sm-elevation md:block">
                <CatalogTable
                  rows={rows}
                  onManage={openManage}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              </div>

              {services.hasNextPage ? (
                <button
                  type="button"
                  onClick={() => void services.fetchNextPage()}
                  disabled={services.isFetchingNextPage}
                  className="flex h-10 w-full items-center justify-center rounded-control border border-gray-300 bg-white text-body font-medium text-text transition-colors hover:bg-gray-50 disabled:opacity-60 md:w-auto md:self-center md:px-6"
                >
                  {services.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <ServiceForm
        open={isAddOpen}
        mode="create"
        regions={regions.data ?? []}
        isLoadingRegions={regions.isPending}
        isSaving={createService.isPending}
        error={createService.error}
        onSubmit={handleSubmit}
        onClose={closeForm}
      />
    </AdminLayout>
  );
}

function CatalogSkeleton() {
  return (
    <div className="w-full" aria-hidden="true">
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-[10.5rem] animate-pulse rounded-card bg-gray-200"
          />
        ))}
      </div>

      <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
        <div className="h-12 w-full border-b border-gray-200 bg-[var(--table-header-bg)]" />
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex h-20 items-center border-b border-gray-200 px-6 last:border-b-0 lg:h-[4.5rem]"
          >
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
