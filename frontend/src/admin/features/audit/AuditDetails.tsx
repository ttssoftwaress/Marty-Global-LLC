import {
  DetailField,
  DetailGrid,
  DetailPanel,
  DetailSection,
} from '../../components/ExpandableRow';
import { auditMetadataEntries } from '../../lib/audit';
import type { AdminAuditRow } from '../../types/audit';
import { useAdminAuditEntry } from './queries';

/*
 * The expanded panel under an audit row — everything the row itself does not
 * carry: the raw action verb, the full entity id, the caller's IP, and every
 * metadata value.
 *
 * It FETCHES, and that is the point. The list deliberately no longer ships the
 * metadata blob (the one column here with no bounded size), so this component
 * asks for the one entry it is showing. It is only mounted while its row is
 * open, so the request happens on expand — a page of fifty entries makes one
 * call, for the entry somebody is actually reading.
 *
 * Shared by the table and the mobile cards so an entry reads identically at
 * every width — the one part of this screen where the two presentations must not
 * diverge, because it is what somebody copies into an incident note.
 *
 * The raw verb is printed alongside the label on purpose. The label is wording
 * the backend can change; the verb is the stable identifier, and it is what
 * anyone querying the table directly will search on.
 */

export function AuditDetails({ entry }: { entry: AdminAuditRow }) {
  const detail = useAdminAuditEntry(entry.id);
  const metadata = auditMetadataEntries(detail.data?.metadata);

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this entry’s details."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Action" mono>
          {entry.action}
        </DetailField>

        <DetailField label="Record">
          {entry.entityType}
          <br />
          <code className="text-small text-text-secondary">{entry.entityId}</code>
        </DetailField>

        <DetailField label="Actor">
          {entry.actor.name}
          {entry.actor.roleLabel ? (
            <span className="block text-small text-gray-500">
              {entry.actor.roleLabel}
            </span>
          ) : null}
          {entry.actor.id ? (
            <code className="block text-small text-text-secondary">
              {entry.actor.id}
            </code>
          ) : null}
        </DetailField>

        {/* Absent for anything a job wrote — a background processor has no
            request and therefore no caller address. */}
        <DetailField label="IP address">{detail.data?.ipAddress}</DetailField>
      </DetailGrid>

      <DetailSection title="Details">
        {metadata.length === 0 ? (
          <p className="text-body text-gray-500">
            This entry recorded no additional detail.
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {metadata.map((item) => (
              <div key={item.key} className="flex flex-wrap items-baseline gap-2">
                <dt className="text-small font-medium text-gray-500">{item.key}</dt>
                <dd className="min-w-0 break-words text-small text-text">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </DetailSection>
    </DetailPanel>
  );
}
