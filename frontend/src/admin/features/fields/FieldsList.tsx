import {
  AlignLeft,
  FileText,
  GitBranch,
  List,
  Type,
  type LucideIcon,
} from 'lucide-react';

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
 *
 * A dependent dropdown carries a fifth: which question filters its choices. It
 * is a badge rather than a column because it is empty on nearly every row — but
 * it has to be visible somewhere, since it is what makes a field's choices
 * conditional and what stops it being deleted or retyped.
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
      renderBadges={(item) =>
        item.config.dependsOn ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-primary-light px-2 py-0.5 text-caption font-medium text-primary">
            <GitBranch className="size-3" strokeWidth={1.75} aria-hidden="true" />
            Depends on {item.config.dependsOn}
          </span>
        ) : null
      }
      onEdit={onEdit}
      onDelete={onDelete}
      deletingId={deletingId}
    />
  );
}
