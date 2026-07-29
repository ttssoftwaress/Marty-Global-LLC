import type { ReactNode } from 'react';

import { auditMetadataEntries } from '../../lib/audit';
import type { AdminAuditRow } from '../../types/audit';

/*
 * The expanded panel under an audit row — everything the row itself does not
 * have space for: the raw action verb, the full entity id, the caller's IP, and
 * every metadata value.
 *
 * Shared by the table and the mobile cards so an entry reads identically at
 * every width — the one part of this screen where the two presentations must not
 * diverge, because it is what somebody copies into an incident note.
 *
 * The raw verb is printed alongside the label on purpose. The label is wording
 * the backend can change; the verb is the stable identifier, and it is what
 * anyone querying the table directly will search on.
 */

const TERM = 'text-caption font-semibold uppercase tracking-[0.6px] text-gray-500';
const VALUE = 'break-all text-body text-text';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className={TERM}>{label}</dt>
      <dd className={VALUE}>{children}</dd>
    </div>
  );
}

export function AuditDetails({ entry }: { entry: AdminAuditRow }) {
  const metadata = auditMetadataEntries(entry.metadata);

  return (
    <div className="flex flex-col gap-4 rounded-input bg-gray-50 p-4">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Action">
          <code className="text-small text-text-secondary">{entry.action}</code>
        </Field>

        <Field label="Record">
          {entry.entityType}
          <br />
          <code className="text-small text-text-secondary">{entry.entityId}</code>
        </Field>

        <Field label="Actor">
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
        </Field>

        {/* Absent for anything a job wrote — a background processor has no
            request and therefore no caller address. An em dash rather than a
            hidden field, so the column does not shift between rows. */}
        <Field label="IP address">{entry.ipAddress ?? '—'}</Field>
      </dl>

      <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
        <p className={TERM}>Details</p>

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
      </div>
    </div>
  );
}
