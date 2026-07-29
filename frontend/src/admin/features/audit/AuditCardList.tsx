import { ChevronDown } from 'lucide-react';

import { auditMetadataPreview, shortEntityId } from '../../lib/audit';
import { formatAuditTime } from '../../lib/format';
import type { AdminAuditRow } from '../../types/audit';
import { AuditActorAvatar } from './AuditActorAvatar';
import { AuditDetails } from './AuditDetails';
import { AuditSeverityChip } from './AuditSeverityChip';

/*
 * The mobile presentation of the trail — one card per entry, replacing the table
 * below `md`.
 *
 * The card leads with the action chip rather than the timestamp, which is the
 * opposite of the table's column order and deliberate: a table is scanned down a
 * timestamp column, but a stack of cards is scanned by what happened, and the
 * time is the qualifier. The timestamp sits under it in the same tabular
 * figures, so the sequence still reads cleanly down the stack.
 *
 * The record (entity type and id) folds into the expanded panel here, as it does
 * at the tablet width — a cuid is the widest thing on the entry and the least
 * useful before anyone has decided to look closely.
 *
 * The whole card header is the expander, rather than a small chevron button: at
 * this width the row is a touch target and a 32px control beside it would be the
 * only thing on the screen that is hard to hit.
 */

type AuditCardListProps = {
  entries: AdminAuditRow[];
  expandedId: string | null;
  onToggle: (id: string) => void;
};

export function AuditCardList({
  entries,
  expandedId,
  onToggle,
}: AuditCardListProps) {
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {entries.map((entry) => {
        const isExpanded = entry.id === expandedId;
        const preview = auditMetadataPreview(entry.metadata);
        const panelId = `audit-card-details-${entry.id}`;

        return (
          <li
            key={entry.id}
            className="flex flex-col overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation"
          >
            <button
              type="button"
              onClick={() => onToggle(entry.id)}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              className="flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <AuditSeverityChip
                  severity={entry.severity}
                  label={entry.actionLabel}
                />

                <ChevronDown
                  className={`mt-0.5 size-4 shrink-0 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>

              <span className="text-small tabular-nums text-text-secondary">
                {formatAuditTime(entry.createdAt)}
              </span>

              <div className="flex items-center gap-2">
                <AuditActorAvatar actor={entry.actor} className="size-7" />

                <span className="min-w-0 flex-1 truncate text-small text-gray-500">
                  {entry.actor.name}
                  {entry.actor.roleLabel ? (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span className="sr-only">, </span>
                      {entry.actor.roleLabel}
                    </>
                  ) : null}
                </span>
              </div>

              {preview ? (
                <span className="line-clamp-2 text-small text-gray-500">
                  {preview}
                </span>
              ) : (
                <span className="truncate text-small text-gray-400">
                  {entry.entityType} · {shortEntityId(entry.entityId)}
                </span>
              )}
            </button>

            {isExpanded ? (
              <div id={panelId} className="border-t border-gray-200 p-4">
                <AuditDetails entry={entry} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
