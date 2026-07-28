import { useState } from 'react';

import { ApiError } from '@/services/api';
import { formatCarrierUsage, moveInList } from '../../lib/settings';
import type { AdminCarrier } from '../../types/settings';
import { ToggleSwitch } from '../catalog/detail/ToggleSwitch';
import { CarrierFormDialog } from './CarrierFormDialog';
import { ReorderButtons, RowActions } from './LocationsPanel';
import { ActiveChip, SettingsPanel, SettingsTh } from './SettingsPanel';
import {
  useAdminCarriers,
  useCreateCarrier,
  useDeleteCarrier,
  useReorderCarriers,
  useUpdateCarrier,
} from './queries';

/*
 * Mail carriers — who the mail room forwards parcels with.
 *
 * The same shape as the locations panel above it, sharing its row controls: a
 * carrier is the same kind of record, so an admin who has learned one list can
 * work the other without re-reading it. Only the columns differ — a carrier has
 * no flag, and its usage is shipments rather than coverage.
 *
 * `MailRequest.carrier` stores the code as plain text so a shipped parcel keeps
 * naming its carrier after the row is retired. Which is exactly why Delete
 * disappears once anything has shipped: no foreign key would stop it, and those
 * requests would start printing a bare code.
 */

export function CarriersPanel({ canWrite }: { canWrite: boolean }) {
  const carriers = useAdminCarriers();
  const createCarrier = useCreateCarrier();
  const updateCarrier = useUpdateCarrier();
  const deleteCarrier = useDeleteCarrier();
  const reorderCarriers = useReorderCarriers();

  const [editing, setEditing] = useState<AdminCarrier | 'new' | null>(null);

  const rows = carriers.data ?? [];

  const openCreate = () => {
    createCarrier.reset();
    updateCarrier.reset();
    setEditing('new');
  };

  const openEdit = (carrier: AdminCarrier) => {
    createCarrier.reset();
    updateCarrier.reset();
    setEditing(carrier);
  };

  const close = () => setEditing(null);

  const editingCarrier = editing === 'new' ? null : editing;
  const isSaving = createCarrier.isPending || updateCarrier.isPending;

  const message = (error: unknown, fallback: string) =>
    error instanceof ApiError ? error.message : error ? fallback : null;

  const saveError = message(
    createCarrier.error ?? updateCarrier.error,
    'Something went wrong saving this carrier. Please try again.',
  );

  // The update error only while the dialog is closed — with it open the same
  // failure is already reported in its footer. See the locations panel.
  const rowError = message(
    deleteCarrier.error ??
      reorderCarriers.error ??
      (editing === null ? updateCarrier.error : null),
    'Something went wrong updating the carriers. Please try again.',
  );

  const move = (index: number, direction: -1 | 1) => {
    deleteCarrier.reset();
    reorderCarriers.mutate(
      moveInList(rows, index, index + direction).map((row) => row.code),
    );
  };

  const toggleActive = (carrier: AdminCarrier, active: boolean) => {
    deleteCarrier.reset();
    updateCarrier.mutate({ code: carrier.code, payload: { active } });
  };

  return (
    <>
      <SettingsPanel
        title="Mail carriers"
        description="Who the mail room ships with. These are the choices the forwarding form offers when an operator sends a customer's mail on."
        addLabel="Add carrier"
        onAdd={openCreate}
        canWrite={canWrite}
        isLoading={carriers.isLoading}
        error={
          carriers.isError
            ? 'Could not load your carriers. Reload the page to try again.'
            : rowError
        }
        emptyTitle="No carriers yet"
        emptyBody="Add the couriers you forward mail with. Until there is at least one, the forwarding form has nothing to offer and a parcel cannot be marked as shipped."
        // A failed fetch is not an empty list — see the locations panel.
        isEmpty={!carriers.isError && rows.length === 0}
      >
        {/* Table — md and up */}
        <div className="hidden overflow-x-auto rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {canWrite && <SettingsTh>Order</SettingsTh>}
                <SettingsTh>Carrier</SettingsTh>
                <SettingsTh>Code</SettingsTh>
                <SettingsTh>Used by</SettingsTh>
                <SettingsTh>{canWrite ? 'Offered' : 'Status'}</SettingsTh>
                <th className="w-px px-4 py-3" />
              </tr>
            </thead>

            <tbody>
              {rows.map((carrier, index) => (
                <tr
                  key={carrier.code}
                  className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
                >
                  {canWrite && (
                    <td className="px-4 py-3">
                      <ReorderButtons
                        label={carrier.label}
                        isFirst={index === 0}
                        isLast={index === rows.length - 1}
                        disabled={reorderCarriers.isPending}
                        onMove={(direction) => move(index, direction)}
                      />
                    </td>
                  )}

                  <td className="px-4 py-3 text-body font-medium text-text">
                    {carrier.label}
                  </td>

                  <td className="px-4 py-3">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700">
                      {carrier.code}
                    </code>
                  </td>

                  <td className="px-4 py-3 text-body text-text-secondary">
                    {formatCarrierUsage(carrier)}
                  </td>

                  <td className="px-4 py-3">
                    {canWrite ? (
                      <ToggleSwitch
                        checked={carrier.active}
                        onChange={(next) => toggleActive(carrier, next)}
                        label={`Ship with ${carrier.label}`}
                        disabled={updateCarrier.isPending}
                      />
                    ) : (
                      <ActiveChip active={carrier.active} />
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {canWrite && (
                      <RowActions
                        name={carrier.label}
                        canDelete={carrier.canDelete}
                        isDeleting={deleteCarrier.isPending}
                        onEdit={() => openEdit(carrier)}
                        onDelete={() => {
                          deleteCarrier.reset();
                          deleteCarrier.mutate(carrier.code);
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards — below md */}
        <ul className="flex flex-col gap-3 md:hidden">
          {rows.map((carrier, index) => (
            <li
              key={carrier.code}
              className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-body font-medium text-text">
                    {carrier.label}
                  </span>
                  <code className="w-fit rounded bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700">
                    {carrier.code}
                  </code>
                </div>

                {canWrite ? (
                  <ToggleSwitch
                    checked={carrier.active}
                    onChange={(next) => toggleActive(carrier, next)}
                    label={`Ship with ${carrier.label}`}
                    disabled={updateCarrier.isPending}
                  />
                ) : (
                  <ActiveChip active={carrier.active} />
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
                <span className="text-caption text-gray-500">
                  {formatCarrierUsage(carrier)}
                </span>

                {canWrite && (
                  <div className="flex items-center gap-1">
                    <ReorderButtons
                      label={carrier.label}
                      isFirst={index === 0}
                      isLast={index === rows.length - 1}
                      disabled={reorderCarriers.isPending}
                      onMove={(direction) => move(index, direction)}
                    />
                    <RowActions
                      name={carrier.label}
                      canDelete={carrier.canDelete}
                      isDeleting={deleteCarrier.isPending}
                      onEdit={() => openEdit(carrier)}
                      onDelete={() => {
                        deleteCarrier.reset();
                        deleteCarrier.mutate(carrier.code);
                      }}
                      compact
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </SettingsPanel>

      <CarrierFormDialog
        open={editing !== null}
        carrier={editingCarrier}
        isSaving={isSaving}
        error={saveError}
        onClose={close}
        onSubmit={(payload) => {
          if (payload.mode === 'create') {
            createCarrier.mutate(payload.body, { onSuccess: close });
            return;
          }

          if (!editingCarrier) return;
          createCarrier.reset();
          updateCarrier.mutate(
            { code: editingCarrier.code, payload: payload.body },
            { onSuccess: close },
          );
        }}
      />
    </>
  );
}
