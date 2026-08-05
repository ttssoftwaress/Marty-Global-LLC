import { Fragment, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';

import { ApiError } from '@/services/api';
import {
  DetailRow,
  ExpandChevronCell,
  detailPanelId,
  expandRowProps,
  expandedRowClass,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatLocationUsage, moveInList } from '../../lib/settings';
import type { AdminLocation } from '../../types/settings';
import { ToggleSwitch } from '../catalog/detail/ToggleSwitch';
import { LocationFormDialog } from './LocationFormDialog';
import { ActiveChip, SettingsPanel, SettingsTh } from './SettingsPanel';
import { LocationDetails } from './SettingsRowDetails';
import {
  useAdminLocations,
  useCreateLocation,
  useDeleteLocation,
  useReorderLocations,
  useUpdateLocation,
} from './queries';

/*
 * Locations — the jurisdictions services are offered in.
 *
 * This is the screen that makes the list real data instead of a seed script.
 * Everything downstream reads it: the catalog's coverage picker, the orders
 * queue's region filter, the chip on a customer's row. Adding a country here is
 * what opens it, and nothing else does.
 *
 * Three controls per row, and each is a different decision:
 *   - the switch closes a location to new orders while leaving it on the records
 *     that already reference it. This is how a jurisdiction normally leaves.
 *   - Delete only appears for a location nothing has ever referenced — the
 *     "added by mistake" case. The backend refuses the rest, so this is the UI
 *     agreeing with a rule it does not own.
 *   - the arrows set the order every picker prints them in.
 *
 * Table from `md` up, cards below it — the same responsive split the catalog,
 * team, and field-registry lists use, so the admin area reads consistently.
 */

export function LocationsPanel({ canWrite }: { canWrite: boolean }) {
  const locations = useAdminLocations();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();
  const reorderLocations = useReorderLocations();

  // Open when set: a location to edit, or `'new'` to add one. One flag rather
  // than two, so the two states cannot both be on.
  const [editing, setEditing] = useState<AdminLocation | 'new' | null>(null);

  const { expandedId, toggle } = useExpandedRow();

  const rows = locations.data ?? [];

  const openCreate = () => {
    createLocation.reset();
    updateLocation.reset();
    setEditing('new');
  };

  const openEdit = (location: AdminLocation) => {
    createLocation.reset();
    updateLocation.reset();
    setEditing(location);
  };

  const close = () => setEditing(null);

  const editingLocation = editing === 'new' ? null : editing;
  const isSaving = createLocation.isPending || updateLocation.isPending;

  const message = (error: unknown, fallback: string) =>
    error instanceof ApiError ? error.message : error ? fallback : null;

  const saveError = message(
    createLocation.error ?? updateLocation.error,
    'Something went wrong saving this location. Please try again.',
  );

  /*
   * Errors from the row controls, which have no dialog to report into. The
   * refusal to delete a location in use arrives here, and it is the one the
   * admin most needs to read — so it sits above the list rather than vanishing.
   *
   * The update error is included only while the dialog is closed: with it open,
   * the same failure is already reported in the footer beside the button that
   * caused it, and printing it twice reads as two problems.
   */
  const rowError = message(
    deleteLocation.error ??
      reorderLocations.error ??
      (editing === null ? updateLocation.error : null),
    'Something went wrong updating the locations. Please try again.',
  );

  const move = (index: number, direction: -1 | 1) => {
    deleteLocation.reset();
    reorderLocations.mutate(
      moveInList(rows, index, index + direction).map((row) => row.code),
    );
  };

  const toggleActive = (location: AdminLocation, active: boolean) => {
    deleteLocation.reset();
    updateLocation.mutate({ code: location.code, payload: { active } });
  };

  const remove = (location: AdminLocation) => {
    deleteLocation.reset();
    deleteLocation.mutate(location.code);
  };

  return (
    <>
      <SettingsPanel
        title="Locations"
        description="The jurisdictions you operate in. Services are offered per location, orders are filed under one, and every region filter in the admin reads this list."
        addLabel="Add location"
        onAdd={openCreate}
        canWrite={canWrite}
        isLoading={locations.isLoading}
        error={
          locations.isError
            ? 'Could not load your locations. Reload the page to try again.'
            : rowError
        }
        emptyTitle="No locations yet"
        emptyBody="Add the countries and regions you file in. Until there is at least one, services have no coverage to offer and orders cannot be filed under a jurisdiction."
        // A failed fetch is not an empty list: showing "No locations yet" over a
        // load error would read as data loss rather than a request that failed.
        isEmpty={!locations.isError && rows.length === 0}
      >
        {/* Table — md and up */}
        <div className="table-scroll hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
          <table className="data-table min-w-[45rem]">
            <thead>
              <tr>
                {canWrite && <SettingsTh>Order</SettingsTh>}
                <SettingsTh>Location</SettingsTh>
                <SettingsTh>Code</SettingsTh>
                <SettingsTh>Used by</SettingsTh>
                <SettingsTh>{canWrite ? 'Offered' : 'Status'}</SettingsTh>
                <th className="w-px px-4" />
                <th className="w-[4rem] px-4">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((location, index) => {
                const isExpanded = location.code === expandedId;
                const panelId = detailPanelId('location', location.code);

                return (
                <Fragment key={location.code}>
                <tr
                  {...expandRowProps({
                    isExpanded,
                    panelId,
                    onToggle: () => toggle(location.code),
                    label: `${isExpanded ? 'Hide' : 'Show'} what references ${location.label}`,
                  })}
                  className={expandedRowClass(isExpanded)}
                >
                  {canWrite && (
                    <td className="px-4 py-3" onClick={stopRowToggle}>
                      <ReorderButtons
                        label={location.label}
                        isFirst={index === 0}
                        isLast={index === rows.length - 1}
                        disabled={reorderLocations.isPending}
                        onMove={(direction) => move(index, direction)}
                      />
                    </td>
                  )}

                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-medium">
                      {location.flag && (
                        <span aria-hidden="true">{location.flag}</span>
                      )}
                      {location.label}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700">
                      {location.code}
                    </code>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                    {formatLocationUsage(location)}
                  </td>

                  <td className="px-4 py-3" onClick={stopRowToggle}>
                    {canWrite ? (
                      <ToggleSwitch
                        checked={location.active}
                        onChange={(next) => toggleActive(location, next)}
                        label={`Offer ${location.label}`}
                        disabled={updateLocation.isPending}
                      />
                    ) : (
                      <ActiveChip active={location.active} />
                    )}
                  </td>

                  <td className="px-4 py-3" onClick={stopRowToggle}>
                    {canWrite && (
                      <RowActions
                        name={location.label}
                        canDelete={location.canDelete}
                        isDeleting={deleteLocation.isPending}
                        onEdit={() => openEdit(location)}
                        onDelete={() => remove(location)}
                      />
                    )}
                  </td>

                  <ExpandChevronCell isExpanded={isExpanded} className="px-4" />
                </tr>

                {isExpanded ? (
                  <DetailRow panelId={panelId} colSpan={canWrite ? 7 : 6}>
                    <LocationDetails location={location} />
                  </DetailRow>
                ) : null}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Cards — below md */}
        <ul className="flex flex-col gap-3 md:hidden">
          {rows.map((location, index) => (
            <li
              key={location.code}
              className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2 text-body font-medium text-text">
                    {location.flag && (
                      <span aria-hidden="true">{location.flag}</span>
                    )}
                    {location.label}
                  </span>
                  <code className="w-fit rounded bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700">
                    {location.code}
                  </code>
                </div>

                {canWrite ? (
                  <ToggleSwitch
                    checked={location.active}
                    onChange={(next) => toggleActive(location, next)}
                    label={`Offer ${location.label}`}
                    disabled={updateLocation.isPending}
                  />
                ) : (
                  <ActiveChip active={location.active} />
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
                <span className="text-caption text-gray-500">
                  {formatLocationUsage(location)}
                </span>

                {canWrite && (
                  <div className="flex items-center gap-1">
                    <ReorderButtons
                      label={location.label}
                      isFirst={index === 0}
                      isLast={index === rows.length - 1}
                      disabled={reorderLocations.isPending}
                      onMove={(direction) => move(index, direction)}
                    />
                    <RowActions
                      name={location.label}
                      canDelete={location.canDelete}
                      isDeleting={deleteLocation.isPending}
                      onEdit={() => openEdit(location)}
                      onDelete={() => remove(location)}
                      compact
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </SettingsPanel>

      <LocationFormDialog
        open={editing !== null}
        location={editingLocation}
        isSaving={isSaving}
        error={saveError}
        onClose={close}
        onSubmit={(payload) => {
          if (payload.mode === 'create') {
            createLocation.mutate(payload.body, { onSuccess: close });
            return;
          }

          if (!editingLocation) return;
          createLocation.reset();
          updateLocation.mutate(
            { code: editingLocation.code, payload: payload.body },
            { onSuccess: close },
          );
        }}
      />
    </>
  );
}

/*
 * Move a row up or down. Two buttons rather than drag-and-drop: the list is a
 * handful of rows, and arrows work with a keyboard and a screen reader without
 * a second implementation.
 */
export function ReorderButtons({
  label,
  isFirst,
  isLast,
  disabled,
  onMove,
}: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const buttonClass =
    'flex size-8 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-100 hover:text-text disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={disabled || isFirst}
        aria-label={`Move ${label} up`}
        className={buttonClass}
      >
        <ChevronUp className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={disabled || isLast}
        aria-label={`Move ${label} down`}
        className={buttonClass}
      >
        <ChevronDown className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

/*
 * Edit, and delete when it is available at all.
 *
 * Delete is absent rather than disabled for a row in use: a greyed button
 * invites a click that can only ever be refused, and the switch beside it is the
 * action the admin actually wants. `canDelete` comes from the backend, so the
 * rule has one definition.
 */
export function RowActions({
  name,
  canDelete,
  isDeleting,
  onEdit,
  onDelete,
  compact = false,
}: {
  name: string;
  canDelete: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onDelete();
          }}
          disabled={isDeleting}
          className="rounded-control px-3 py-1.5 text-body font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-control px-3 py-1.5 text-body font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={compact ? `Edit ${name}` : undefined}
        className={
          compact
            ? 'flex size-8 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            : 'flex items-center gap-1.5 rounded-control px-3 py-1.5 text-body font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        }
      >
        <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
        {!compact && 'Edit'}
      </button>

      {canDelete && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${name}`}
          className="flex size-8 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
