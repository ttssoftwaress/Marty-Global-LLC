import { MailOpsCustomerAvatar } from './MailOpsCustomerAvatar';
import { formatActivityTimeShort } from '../../lib/format';
import type { MailOpsRecentUpload } from '../../types/mailroom';

/*
 * "Recently uploaded" — the feed of scans filed most recently.
 *
 * The same card at all three widths: rows of avatar, customer over room +
 * sender, and a right-aligned relative timestamp, divided by hairlines with no
 * rule under the last row. Only the scale steps down on mobile (2rem avatar,
 * 12px row padding), matching its link.
 *
 * On desktop this card is the right rail beside the form; on tablet and mobile
 * it drops to a full-width card under it. That placement is the page's call —
 * this component is the card either way.
 *
 * Timestamps arrive as ISO-8601 UTC and are converted to the viewer's zone at
 * render (AGENTS.md, Dates). The desktop link's "2 min ago" and the mobile
 * link's "1h ago" are the same formatter at two widths; the short form is used
 * throughout since the rail is only 380px and a long form would wrap.
 *
 * "Load more" appears only when the cursor stream has another page — the feed
 * is a list like any other in the admin area, so it pages rather than capping.
 */

type MailOpsRecentUploadsProps = {
  uploads: MailOpsRecentUpload[];
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

function RecentRowSkeleton() {
  return (
    <div className="flex w-full items-center gap-3 border-b border-gray-200 py-3 last:border-b-0 lg:gap-4 lg:py-4">
      <div className="size-8 shrink-0 animate-pulse rounded-full bg-gray-200 lg:size-9" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

export function MailOpsRecentUploads({
  uploads,
  isLoading,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: MailOpsRecentUploadsProps) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation lg:p-card">
      <h2 className="text-h6 text-text">Recently uploaded</h2>

      {isLoading ? (
        <div className="flex w-full flex-col" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <RecentRowSkeleton key={index} />
          ))}
        </div>
      ) : uploads.length === 0 ? (
        <p className="py-2 text-body text-gray-400">
          Nothing uploaded yet. Scans you file appear here.
        </p>
      ) : (
        <ul className="flex w-full flex-col">
          {uploads.map((upload) => (
            <li
              key={upload.id}
              className="flex w-full items-center gap-3 border-b border-gray-200 py-3 last:border-b-0 lg:gap-4 lg:py-4"
            >
              <MailOpsCustomerAvatar
                id={upload.customer.id}
                initials={upload.customer.initials}
                className="size-8 text-small lg:size-9"
              />

              {/*
               * The room sits on the secondary line beside the sender: a
               * customer may hold several, so "who" alone does not say which
               * inbox the scan landed in.
               */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:gap-1">
                <p className="truncate text-body font-semibold text-text">
                  {upload.customer.name}
                </p>
                <p className="truncate text-small text-gray-400">
                  {upload.room.name} · {upload.sender}
                </p>
              </div>

              <time
                dateTime={upload.uploadedAt}
                className="shrink-0 text-right text-small text-gray-400"
              >
                {formatActivityTimeShort(upload.uploadedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="w-full rounded-control border border-gray-200 py-2.5 text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:text-gray-400 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {isLoadingMore ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </section>
  );
}
