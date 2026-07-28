import { Fragment } from 'react';
import { ChevronDown } from 'lucide-react';

import { auditMetadataPreview, shortEntityId } from '../../lib/audit';
import { formatAuditTime } from '../../lib/format';
import type { AdminAuditRow } from '../../types/audit';
import { AuditActorAvatar } from './AuditActorAvatar';
import { AuditDetails } from './AuditDetails';
import { AuditSeverityChip } from './AuditSeverityChip';

/*
 * The audit table — the desktop and tablet presentation (mobile renders cards
 * instead; see AuditCardList).
 *
 * One real `<table>` so the columns align, the header is announced, and the
 * values line up under their headings.
 *
 * The two links differ in how much they fit, which the same markup covers:
 *   - desktop (lg): five columns — timestamp, action, actor, record, and the
 *     expand control
 *   - tablet (md):  the record column drops out and folds into the expanded
 *     panel, since an entity type plus a cuid is the widest thing on the row and
 *     the least useful when collapsed
 *
 * Every row expands in place rather than opening a dialog. An audit trail is
 * read by scanning and then drilling into two or three entries, and a modal per
 * row would mean losing the scan position on every one — the whole reason a
 * reader is here is to compare an entry against its neighbours.
 *
 * The expander is a real `<button>` carrying `aria-expanded` and controlling the
 * panel's id, so the state is announced rather than implied by a rotated chevron.
 */

type AuditTableProps = {
  entries: AdminAuditRow[];
  expandedId: string | null;
  onToggle: (id: string) => void;
};

const HEAD_CELL =
  'px-0 py-0 text-left text-caption font-semibold uppercase tracking-[0.6px] text-gray-500';

export function AuditTable({ entries, expandedId, onToggle }: AuditTableProps) {
  return (
    <div className="hidden w-full overflow-x-auto md:block">
      <table className="w-full min-w-[44rem] table-fixed border-collapse text-left lg:min-w-[60rem] lg:table-auto">
        <thead>
          <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)]">
            <th scope="col" className={`${HEAD_CELL} w-[11.5rem] pl-5 pr-4 lg:w-[13rem] lg:pl-card`}>
              When
            </th>
            <th scope="col" className={`${HEAD_CELL} pr-4`}>
              Action
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[11rem] pr-4 lg:w-[13rem]`}>
              Actor
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} hidden w-[13rem] pr-4 lg:table-cell`}
            >
              Record
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[4rem] pr-5 lg:pr-card`}>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => {
            const isExpanded = entry.id === expandedId;
            const preview = auditMetadataPreview(entry.metadata);
            const panelId = `audit-details-${entry.id}`;

            return (
              // A row and its details panel are two `<tr>`s, so the key belongs
              // on the fragment holding both rather than on either one.
              <Fragment key={entry.id}>
                <tr
                  className={`border-b border-gray-200 transition-colors ${
                    isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="py-3 pl-5 pr-4 align-top lg:pl-card">
                    <span className="block whitespace-nowrap pt-1 text-small tabular-nums text-text-secondary">
                      {formatAuditTime(entry.createdAt)}
                    </span>
                  </td>

                  <td className="min-w-0 py-3 pr-4 align-top">
                    <div className="flex min-w-0 flex-col gap-1">
                      <AuditSeverityChip
                        severity={entry.severity}
                        label={entry.actionLabel}
                      />

                      {preview ? (
                        <span className="truncate text-small text-gray-500">
                          {preview}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="py-3 pr-4 align-top">
                    <div className="flex items-center gap-2 pt-0.5">
                      <AuditActorAvatar actor={entry.actor} />

                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-body text-text">
                          {entry.actor.name}
                        </span>
                        {entry.actor.roleLabel ? (
                          <span className="truncate text-small text-gray-500">
                            {entry.actor.roleLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="hidden py-3 pr-4 align-top lg:table-cell">
                    <div className="flex min-w-0 flex-col pt-0.5">
                      <span className="truncate text-body text-text">
                        {entry.entityType}
                      </span>
                      <code className="truncate text-small text-gray-500">
                        {shortEntityId(entry.entityId)}
                      </code>
                    </div>
                  </td>

                  <td className="py-3 pr-5 align-top lg:pr-card">
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => onToggle(entry.id)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${entry.actionLabel}`}
                        className="flex size-8 items-center justify-center rounded-control border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <ChevronDown
                          className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </td>
                </tr>

                {isExpanded ? (
                  <tr className="border-b border-gray-200">
                    <td
                      id={panelId}
                      colSpan={5}
                      className="bg-gray-50 px-5 pb-4 pt-0 lg:px-card"
                    >
                      <AuditDetails entry={entry} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
