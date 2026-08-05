import { Fragment } from 'react';

import {
  DetailRow,
  ExpandChevronCell,
  detailPanelId,
  expandRowProps,
  expandedRowClass,
} from '../../components/ExpandableRow';
import { shortEntityId } from '../../lib/audit';
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
 *     expand affordance
 *   - tablet (md):  the record column drops out and folds into the expanded
 *     panel, since an entity type plus a cuid is the widest thing on the row and
 *     the least useful when collapsed
 *
 * Every row expands in place rather than opening a dialog. An audit trail is
 * read by scanning and then drilling into two or three entries, and a modal per
 * row would mean losing the scan position on every one — the whole reason a
 * reader is here is to compare an entry against its neighbours.
 *
 * The whole ROW is the toggle, not the chevron beside it. A row of scannable
 * text with one 32px target at the end is a control most readers miss, and the
 * enlarged target costs nothing here because an audit row holds no other
 * controls. The chevron stays as the affordance and is `aria-hidden`; the row
 * itself carries `aria-expanded` and controls the panel's id, so the state is
 * announced rather than implied by a rotated glyph.
 */

type AuditTableProps = {
  entries: AdminAuditRow[];
  expandedId: string | null;
  onToggle: (id: string) => void;
};

export function AuditTable({ entries, expandedId, onToggle }: AuditTableProps) {
  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[44rem] table-fixed lg:min-w-[60rem] lg:table-auto">
        <thead>
          <tr className="h-12">
            <th
              scope="col"
              className="w-[11.5rem] pl-5 pr-4 lg:w-[13rem] lg:pl-card"
            >
              When
            </th>
            <th scope="col" className="pr-4">
              Action
            </th>
            <th scope="col" className="w-[11rem] pr-4 lg:w-[13rem]">
              Actor
            </th>
            <th scope="col" className="hidden w-[13rem] pr-4 lg:table-cell">
              Record
            </th>
            <th scope="col" className="w-[4rem] pr-5 lg:pr-card">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => {
            const isExpanded = entry.id === expandedId;
            const panelId = detailPanelId('audit', entry.id);

            return (
              // A row and its details panel are two `<tr>`s, so the key belongs
              // on the fragment holding both rather than on either one.
              <Fragment key={entry.id}>
                <tr
                  {...expandRowProps({
                    isExpanded,
                    panelId,
                    onToggle: () => onToggle(entry.id),
                    label: `${isExpanded ? 'Hide' : 'Show'} details for ${entry.actionLabel}`,
                  })}
                  className={expandedRowClass(isExpanded)}
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

                      {entry.metadataPreview ? (
                        <span className="truncate text-small text-gray-500">
                          {entry.metadataPreview}
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

                  <ExpandChevronCell
                    isExpanded={isExpanded}
                    className="align-top pr-5 lg:pr-card"
                  />
                </tr>

                {isExpanded ? (
                  <DetailRow panelId={panelId} colSpan={5}>
                    <AuditDetails entry={entry} />
                  </DetailRow>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
