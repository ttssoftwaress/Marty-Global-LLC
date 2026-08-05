import {
  DetailField,
  DetailGrid,
  DetailPanel,
  DetailSection,
} from '../../components/ExpandableRow';
import { formatCatalogDate } from '../../lib/catalog';
import type { CatalogServiceRow } from '../../types/catalog';
import { useAdminCatalogService } from './queries';

/*
 * The expanded panel under a catalog row — what the service actually is, as
 * opposed to what the row says about it: the customer-facing description, the
 * questions its request form asks, and the facts it delivers back.
 *
 * Those three are the whole shape of a service and the reason someone opens a
 * catalog row, and none of them fit in a table cell. They are fetched on expand
 * through the same read the Manage form uses, so opening Manage afterwards is
 * served from cache rather than a second round trip.
 */

export function CatalogRowDetails({ row }: { row: CatalogServiceRow }) {
  const detail = useAdminCatalogService(row.id);
  const data = detail.data;

  const fieldCount = data
    ? (data.formSteps?.reduce((total, step) => total + step.fields.length, 0) ??
      data.detailFields.length)
    : 0;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this service."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Regions">{row.regions.length || null}</DetailField>
        <DetailField label="Questions asked">{fieldCount || null}</DetailField>
        <DetailField label="Facts delivered">
          {data?.resultFields.length || null}
        </DetailField>
        <DetailField label="Last updated">
          {formatCatalogDate(row.updatedAt)}
        </DetailField>
      </DetailGrid>

      <DetailSection title="What the customer reads">
        <p className="text-body text-text">
          {data?.description || 'No description has been written yet.'}
        </p>
        {data && data.features.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1">
            {data.features.map((feature) => (
              <li key={feature} className="text-body text-text-secondary">
                • {feature}
              </li>
            ))}
          </ul>
        ) : null}
      </DetailSection>

      <DetailSection title="Delivers">
        {data && data.resultFields.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {/* The registry keys the service returns. The labels live in the
                result registry, which this row has no reason to load — the key
                is what a catalog editor recognises anyway. */}
            {data.resultFields.map((field) => (
              <li
                key={field.fieldKey}
                className="inline-flex items-center gap-1 rounded-pill bg-gray-100 px-2.5 py-1 text-caption font-medium text-gray-700"
              >
                <code>{field.fieldKey}</code>
                {field.isPrimary ? (
                  <span className="text-primary">· title</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-gray-500">
            This service delivers no structured record, so it has no customer
            page of its own.
          </p>
        )}
      </DetailSection>
    </DetailPanel>
  );
}
