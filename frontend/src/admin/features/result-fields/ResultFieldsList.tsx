import {
  AlignLeft,
  CalendarDays,
  CircleDot,
  FileText,
  Hash,
  Link2,
  List,
  Star,
  Type,
  type LucideIcon,
} from 'lucide-react';

import { RegistryList } from '../../components/RegistryList';
import {
  resultFieldTypeLabel,
  type ResultFieldDefinition,
} from '../../types/delivery';

/*
 * The result registry — the shared `RegistryList` with this registry's type
 * glyphs, column heading, and the one badge the request registry has no
 * equivalent for.
 *
 * Each row prints what decides whether to reuse a fact or register a new one:
 * what it is, the key values are stored under, what kind of value it holds, and
 * how many services already return it.
 */

const TYPE_ICON: Record<string, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  select: List,
  status: CircleDot,
  date: CalendarDays,
  number: Hash,
  url: Link2,
  file: FileText,
};

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

type ResultFieldsListProps = {
  fields: ResultFieldDefinition[];
  onEdit: (field: ResultFieldDefinition) => void;
  onDelete: (field: ResultFieldDefinition) => void;
  deletingId: string | null;
};

export function ResultFieldsList({
  fields,
  onEdit,
  onDelete,
  deletingId,
}: ResultFieldsListProps) {
  return (
    <RegistryList
      fields={fields}
      usageHeading="Returned by"
      typeIcon={(type) => TYPE_ICON[type] ?? Type}
      typeLabel={resultFieldTypeLabel}
      renderBadges={(field) => (field.isPrimary ? <PrimaryChip /> : null)}
      onEdit={onEdit}
      onDelete={onDelete}
      deletingId={deletingId}
    />
  );
}
