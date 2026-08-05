import {
  DetailActions,
  DetailField,
  DetailGrid,
  DetailNote,
  DetailPanel,
  DetailSection,
  detailActionClass,
} from '../../components/ExpandableRow';
import { formatActivityTime, formatOrderDate } from '../../lib/format';
import { useAdminLead, type AdminLead } from './queries';

/*
 * The expanded panel under a lead — the message in full, plus the two facts the
 * row cannot carry: when it was picked up, and by which route to answer it.
 *
 * It fetches. The list carries a one-line preview only (the message is the
 * record's one unbounded field), and this component is mounted only while its
 * row is open, so a page of the queue makes one call for the lead somebody is
 * reading.
 *
 * Working a lead means calling or emailing the address it carries — there is no
 * reply thread in this system — so the panel's action is a real `mailto:` with
 * the subject already written, rather than a button that opens nothing.
 */

export function LeadDetails({ lead }: { lead: AdminLead }) {
  const detail = useAdminLead(lead.id);

  const mailHref = `mailto:${lead.email}?subject=${encodeURIComponent(
    'Re: your enquiry to Marty Global',
  )}`;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this enquiry."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="From">{lead.name}</DetailField>
        <DetailField label="Email">{lead.email}</DetailField>
        <DetailField label="Received">
          {formatActivityTime(lead.createdAt)}
        </DetailField>
        <DetailField label="Handled">
          {detail.data?.handledAt
            ? formatOrderDate(detail.data.handledAt)
            : 'Not yet'}
        </DetailField>
      </DetailGrid>

      <DetailSection title="Message">
        <DetailNote>{detail.data?.message}</DetailNote>
      </DetailSection>

      <DetailActions>
        <a href={mailHref} className={detailActionClass}>
          Reply by email
        </a>
      </DetailActions>
    </DetailPanel>
  );
}
