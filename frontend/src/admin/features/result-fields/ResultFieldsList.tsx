import {
  AlignLeft,
  Archive,
  CalendarDays,
  CircleDot,
  FileText,
  Hash,
  Link2,
  List,
  Pencil,
  Star,
  Type,
} from 'lucide-react';

import { RowActions } from '../../components/RowActions';
import { formatFieldDate, formatUsage } from '../../lib/fields';
import {
  resultFieldTypeLabel,
  type ResultFieldDefinition,
} from '../../types/delivery';

/*
 * The result registry, as a table from `md` up and as cards below it — the same
 * responsive split the request registry and the catalog use.
 *
 * Each row prints what decides whether to reuse a fact or register a new one:
 * what it is, the key values are stored under, what kind of value it holds, and
 * how many services already return it. That last figure is the blast radius of
 * an edit, which is why it is a column rather than something buried in the
 * dialog.
 */

const TYPE_ICON = {
  text: Type,
  textarea: AlignLeft,
  select: List,
  status: CircleDot,
  date: CalendarDays,
  number: Hash,
  url: Link2,
  file: FileText,
} as const;

function TypeBadge({ type }: { type: string }) {
  const Icon = TYPE_ICON[type as keyof typeof TYPE_ICON] ?? Type;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-gray-100 px-2.5 py-1 text-caption font-medium text-gray-700">
      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      {resultFieldTypeLabel(type)}
    </span>
  );
}

function ArchivedChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-gray-100 px-2 py-0.5 text-caption font-medium text-gray-500">
      <Archive className="size-3" strokeWidth={1.75} aria-hidden="true" />
      Archived
    </span>
  );
}

// The default flag, not a per-service fact: a service that picks this field
// inherits it unless it overrides it.
function PrimaryChip() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill bg-primary-light px-2 py-0.5 text-caption font-medium text-primary"
      title="Titles the record by default"
    >
      <Star className="size-3" strokeWidth={2} aria-hidden="true" />
      Title
    </span>
  );
}

/*
 * Delete is per row and absent rather than disabled: `canDelete` comes from the
 * API and is false as soon as a service returns the fact or a delivered record
 * holds a value for it, both of which are archived instead so the record keeps
 * rendering.
 */
type ResultFieldsListProps = {
  fields: ResultFieldDefinition[];
  onEdit: (field: ResultFieldDefinition) => void;
  onDelete: (field: ResultFieldDefinition) => void;
  deletingId: string | null;
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
      {children}
    </th>
  );
}

type EditButtonProps = {
  field: ResultFieldDefinition;
  onEdit: (field: ResultFieldDefinition) => void;
};

function EditButton({ field, onEdit }: EditButtonProps) {
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

function CompactEditButton({ field, onEdit }: EditButtonProps) {
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

export function ResultFieldsList({
  fields,
  onEdit,
  onDelete,
  deletingId,
}: ResultFieldsListProps) {
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
              <Th>Returned by</Th>
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
                      {field.isPrimary && <PrimaryChip />}
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
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700">
                    {field.key}
                  </code>
                </td>

                <td className="px-4 py-3">
                  <TypeBadge type={field.type} />
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
                  {field.isPrimary && <PrimaryChip />}
                  {field.archived && <ArchivedChip />}
                </div>
                <code className="w-fit rounded bg-gray-100 px-1.5 py-0.5 text-caption text-gray-700">
                  {field.key}
                </code>
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
              <TypeBadge type={field.type} />
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
