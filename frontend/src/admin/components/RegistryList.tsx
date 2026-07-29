import type { ReactNode } from 'react';
import { Archive, Pencil, type LucideIcon } from 'lucide-react';

import { RowActions } from './RowActions';
import { formatFieldDate, formatUsage } from '../lib/field-registry';

/*
 * A registry, as a table from `md` up and as cards below it — the same
 * responsive split the catalog and team lists use, so the admin area reads
 * consistently.
 *
 * Both registries — the questions a service asks and the facts it returns —
 * print the same five things per row, because the decision the admin makes on
 * each is the same one: what it is, the key values are stored under, what kind
 * of value it holds, how many services already reference it, and when it last
 * changed. That fourth figure is the blast radius of an edit, which is why it is
 * a column rather than something buried in the dialog.
 *
 * What genuinely differed between the two copies was the usage column's heading,
 * the icon and label for a type, and the extra badge the result registry prints
 * on a primary field. Those are the props; everything else was duplicated.
 *
 * Delete is per row and ABSENT rather than disabled: `canDelete` comes from the
 * API and is false as soon as anything references the key, because a field a
 * service uses — or that a record holds a value for — is archived instead. A
 * greyed-out button would invite a click that can only ever be refused.
 */

export type RegistryListItem = {
  id: string;
  key: string;
  label: string;
  type: string;
  category?: string;
  archived: boolean;
  usageCount: number;
  updatedAt: string;
  canDelete: boolean;
};

type RegistryListProps<T extends RegistryListItem> = {
  fields: T[];
  // "Used by" for the request registry, "Returned by" for the result one.
  usageHeading: string;
  typeIcon: (type: string) => LucideIcon;
  typeLabel: (type: string) => string;
  // Badges printed after the label, beside the archived chip.
  renderBadges?: (field: T) => ReactNode;
  onEdit: (field: T) => void;
  onDelete: (field: T) => void;
  deletingId: string | null;
};

export function RegistryList<T extends RegistryListItem>({
  fields,
  usageHeading,
  typeIcon,
  typeLabel,
  renderBadges,
  onEdit,
  onDelete,
  deletingId,
}: RegistryListProps<T>) {
  return (
    <>
      {/* Table — md and up */}
      <div className="hidden overflow-x-auto rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
        <table className="w-full min-w-[45rem] border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <Th>Field</Th>
              <Th>Key</Th>
              <Th>Type</Th>
              <Th>{usageHeading}</Th>
              <Th>Updated</Th>
              <th className="w-px px-4 py-3" />
            </tr>
          </thead>

          <tbody>
            {fields.map((field) => (
              <tr
                key={field.id}
                className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-medium text-text">
                        {field.label}
                      </span>
                      {renderBadges?.(field)}
                      {field.archived && <ArchivedChip />}
                    </div>
                    {field.category && (
                      <span className="text-caption text-gray-500">
                        {field.category}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <FieldKey value={field.key} />
                </td>

                <td className="px-4 py-3">
                  <TypeBadge
                    type={field.type}
                    typeIcon={typeIcon}
                    typeLabel={typeLabel}
                  />
                </td>

                <td className="px-4 py-3 text-body text-text-secondary">
                  {formatUsage(field.usageCount)}
                </td>

                <td className="px-4 py-3 text-body text-text-secondary">
                  {formatFieldDate(field.updatedAt)}
                </td>

                <td className="px-4 py-3">
                  {field.canDelete ? (
                    <RowActions
                      name={field.label}
                      isDeleting={deletingId === field.id}
                      onDelete={() => onDelete(field)}
                    >
                      <EditButton field={field} onEdit={onEdit} />
                    </RowActions>
                  ) : (
                    <div className="flex items-center justify-end">
                      <EditButton field={field} onEdit={onEdit} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — below md */}
      <ul className="flex flex-col gap-3 md:hidden">
        {fields.map((field) => (
          <li
            key={field.id}
            className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-medium text-text">
                    {field.label}
                  </span>
                  {renderBadges?.(field)}
                  {field.archived && <ArchivedChip />}
                </div>
                <FieldKey value={field.key} className="w-fit" />
              </div>

              {field.canDelete ? (
                <RowActions
                  name={field.label}
                  isDeleting={deletingId === field.id}
                  onDelete={() => onDelete(field)}
                >
                  <CompactEditButton field={field} onEdit={onEdit} />
                </RowActions>
              ) : (
                <CompactEditButton field={field} onEdit={onEdit} />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
              <TypeBadge
                type={field.type}
                typeIcon={typeIcon}
                typeLabel={typeLabel}
              />
              <span className="text-caption text-gray-500">
                {formatUsage(field.usageCount)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function TypeBadge({
  type,
  typeIcon,
  typeLabel,
}: {
  type: string;
  typeIcon: (type: string) => LucideIcon;
  typeLabel: (type: string) => string;
}) {
  const Icon = typeIcon(type);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-gray-100 px-2.5 py-1 text-caption font-medium text-gray-700">
      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      {typeLabel(type)}
    </span>
  );
}

// The chip both registries print on a retired field. Archiving is the only way
// out for a field in use, so this is the state most rows eventually reach.
export function ArchivedChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-gray-100 px-2 py-0.5 text-caption font-medium text-gray-500">
      <Archive className="size-3" strokeWidth={1.75} aria-hidden="true" />
      Archived
    </span>
  );
}

function FieldKey({ value, className }: { value: string; className?: string }) {
  return (
    <code
      className={`rounded bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700 ${className ?? ''}`}
    >
      {value}
    </code>
  );
}

type EditButtonProps<T extends RegistryListItem> = {
  field: T;
  onEdit: (field: T) => void;
};

function EditButton<T extends RegistryListItem>({
  field,
  onEdit,
}: EditButtonProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onEdit(field)}
      className="flex shrink-0 items-center gap-1.5 rounded-control px-3 py-1.5 text-body font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
      Edit
    </button>
  );
}

function CompactEditButton<T extends RegistryListItem>({
  field,
  onEdit,
}: EditButtonProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onEdit(field)}
      aria-label={`Edit ${field.label}`}
      className="flex size-9 shrink-0 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
      {children}
    </th>
  );
}
