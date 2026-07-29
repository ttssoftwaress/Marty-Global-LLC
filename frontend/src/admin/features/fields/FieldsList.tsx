import { AlignLeft, FileText, List, Type, type LucideIcon } from 'lucide-react';

import { RegistryList } from '../../components/RegistryList';
import type { FieldDefinition } from '../../types/fields';
import { fieldTypeLabel } from '../../types/fields';

/*
 * The request registry — the shared `RegistryList` with this registry's type
 * glyphs and column heading.
 *
 * Each row prints the four things that matter when deciding whether to reuse a
 * field or register a new one: what it asks, the key answers are stored under,
 * what kind of answer it takes, and how many services already ask it.
 */

const TYPE_ICON: Record<string, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  select: List,
  file: FileText,
};

type FieldsListProps = {
  fields: FieldDefinition[];
  onEdit: (field: FieldDefinition) => void;
  onDelete: (field: FieldDefinition) => void;
  deletingId: string | null;
};

export function FieldsList({
  fields,
  onEdit,
  onDelete,
  deletingId,
}: FieldsListProps) {
  return (
    <RegistryList
      fields={fields}
      usageHeading="Used by"
      typeIcon={(type) => TYPE_ICON[type] ?? Type}
      typeLabel={fieldTypeLabel}
      onEdit={onEdit}
      onDelete={onDelete}
      deletingId={deletingId}
    />
  );
}
