import { formatOrderDate } from '../../lib/format';
import type { MailLogRow } from '../../types/mailroom';
import { MailLogActionBadge } from './MailLogActionBadge';
import { MailOpsCustomerAvatar } from './MailOpsCustomerAvatar';

/*
 * The mail log — the desktop and tablet presentation (mobile renders cards
 * instead; see MailLogCardList).
 *
 * One real `<table>` so the columns align, the header is announced, and the
 * badges line up under their headings.
 *
 * The two links differ in more than scale, and both are reproduced from one
 * markup:
 *   - desktop (lg): six columns — "Processed by" is a column of its own, 20px
 *     gutters, a 56px row
 *   - tablet (md):  five columns — the design drops the "Processed by" heading
 *     and folds the name under the date as a second "by …" line, which is what
 *     buys the room; 16px gutters, a 60px row
 *
 * `table-fixed` holds the column allocation at both widths so a long mail-item
 * title truncates instead of pushing the action off the edge.
 *
 * The desktop link zebra-stripes alternate rows. That reads as banding rather
 * than a state, but it fights the hover tint every other admin table uses, so
 * the rows are plain white with a real hover tint here (logged as a deviation).
 */

type MailLogTableProps = {
  entries: MailLogRow[];
  onView: (entry: MailLogRow) => void;
};

const HEAD_CELL =
  'px-0 py-0 text-left text-[10px] font-medium uppercase tracking-[0.6px] text-text-secondary lg:text-caption';

export function MailLogTable({ entries, onView }: MailLogTableProps) {
  return (
    <div className="hidden w-full overflow-x-auto md:block">
      <table className="w-full min-w-[680px] table-fixed border-collapse text-left lg:min-w-[960px]">
        <thead>
          <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)]">
            <th
              scope="col"
              className={`${HEAD_CELL} w-[180px] pl-4 pr-3 lg:w-[220px] lg:pl-5 lg:pr-4`}
            >
              Customer
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[180px] pr-3 lg:w-[240px] lg:pr-4`}
            >
              Mail item
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[150px] pr-3 lg:w-[180px] lg:pr-4`}
            >
              Final action
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[130px] pr-3 lg:w-[140px] lg:pr-4`}
            >
              Date closed
            </th>

            {/*
             * Tablet folds the processor under the date instead of giving it a
             * column, so the heading only exists from `lg` up.
             */}
            <th
              scope="col"
              className={`${HEAD_CELL} hidden w-[160px] pr-4 lg:table-cell`}
            >
              Processed by
            </th>

            <th
              scope="col"
              className={`${HEAD_CELL} w-[80px] pr-4 text-right lg:w-[100px] lg:pr-5`}
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="h-[60px] border-b border-gray-200 transition-colors last:border-b-0 hover:bg-gray-50 lg:h-table-row"
            >
              <td className="py-2 pl-4 pr-3 align-middle lg:pl-5 lg:pr-4">
                <div className="flex items-center gap-2 lg:gap-2.5">
                  <MailOpsCustomerAvatar
                    id={entry.customer.id}
                    initials={entry.customer.initials}
                    className="size-7 text-[11px] lg:size-6 lg:text-[10px]"
                  />
                  <span className="truncate text-[13px] font-medium text-text lg:text-body lg:font-normal">
                    {entry.customer.name}
                  </span>
                </div>
              </td>

              <td className="py-2 pr-3 align-middle lg:pr-4">
                <span className="block truncate text-[13px] text-text lg:text-body lg:text-text-secondary">
                  {entry.mailItem}
                </span>
              </td>

              <td className="py-2 pr-3 align-middle lg:pr-4">
                <MailLogActionBadge
                  action={entry.action}
                  label={entry.actionLabel}
                />
              </td>

              <td className="py-2 pr-3 align-middle lg:pr-4">
                <span className="block whitespace-nowrap text-[13px] text-text lg:text-body lg:text-text-secondary">
                  {formatOrderDate(entry.closedAt)}
                </span>

                {/* Tablet's second line; desktop shows this in its own column. */}
                <span className="block truncate text-caption text-text-secondary lg:hidden">
                  by {entry.processedBy}
                </span>
              </td>

              <td className="hidden py-2 pr-4 align-middle lg:table-cell">
                <span className="block truncate text-body text-text-secondary">
                  {entry.processedBy}
                </span>
              </td>

              <td className="py-2 pl-2 pr-4 align-middle lg:pr-5">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onView(entry)}
                    aria-label={`View ${entry.mailItem} for ${entry.customer.name}`}
                    className="flex h-8 items-center justify-center rounded-control border border-gray-200 bg-white px-3 text-[13px] font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:border-primary lg:px-4 lg:font-semibold"
                  >
                    View
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
