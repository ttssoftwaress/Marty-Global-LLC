import { Link } from 'react-router-dom';

import {
  DetailActions,
  DetailField,
  DetailGrid,
  DetailPanel,
  detailActionMutedClass,
} from '../../components/ExpandableRow';
import { formatFileSize, formatOrderDate } from '../../lib/format';
import type { PortalDocument } from '../../types/documents';

/*
 * The expanded panel under a document row — where the file came from and what
 * it is, which is what turns a filename into something a customer can place.
 *
 * This is the one panel in the portal that does NOT fetch. The library is
 * assembled by the backend from three sources (order documents, delivered-record
 * file values, mail scans) and paged as one list, so a per-row read would re-run
 * that whole gather to hand back fields the row it came from already carries.
 * The lazy part here is the rendering, and the expensive part — the download
 * link — is already minted per request when the button is pressed
 * (AGENTS.md, Security & PII).
 */

const SOURCE_EXPLANATION: Record<PortalDocument['source'], string> = {
  order: 'Filed against one of your orders.',
  record: 'Part of a service record we delivered to you.',
  mail: 'A scan of post that arrived at your virtual mail room.',
};

export function DocumentDetails({ document }: { document: PortalDocument }) {
  return (
    <DetailPanel>
      <DetailGrid>
        <DetailField label="Belongs to">
          <Link
            to={document.contextHref}
            className="truncate text-primary hover:underline"
          >
            {document.contextLabel}
          </Link>
        </DetailField>
        <DetailField label="File type">{document.contentType}</DetailField>
        <DetailField label="Size">
          {document.sizeBytes !== null ? formatFileSize(document.sizeBytes) : null}
        </DetailField>
        <DetailField label="Added">
          {formatOrderDate(document.createdAt)}
        </DetailField>
      </DetailGrid>

      <p className="text-body text-text-secondary">
        {SOURCE_EXPLANATION[document.source]}
        {document.available
          ? ''
          : ' We’ll add the file here once it has been filed.'}
      </p>

      <DetailActions>
        <Link to={document.contextHref} className={detailActionMutedClass}>
          View in context
        </Link>
      </DetailActions>
    </DetailPanel>
  );
}
