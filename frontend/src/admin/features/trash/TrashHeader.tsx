import { Link } from 'react-router-dom';
import { Settings2, Trash2 } from 'lucide-react';

/*
 * The Trash page header — breadcrumb, title block, and the retention notice.
 *
 * The notice carries the one fact that changes how the whole screen reads: how
 * long a deletion stays reversible, and whether the nightly sweep is running at
 * all. An admin arriving here after a mistaken delete is asking exactly that,
 * and it should not take a click to find out.
 *
 * The "Retention" button is admin-only and passed in rather than assumed — a
 * staff member with `trash` can restore, but changing when data stops being
 * recoverable is an account-level decision, the same posture the payment and
 * email switches take.
 *
 * The breadcrumb and subtitle drop away on mobile, matching the rest of the
 * admin portal's headers.
 */

type TrashHeaderProps = {
  retentionDays: number | null;
  purgeEnabled: boolean;
  onEditRetention?: () => void;
};

export function TrashHeader({
  retentionDays,
  purgeEnabled,
  onEditRetention,
}: TrashHeaderProps) {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-4">
      <nav aria-label="Breadcrumb" className="hidden md:block">
        <ol className="flex items-center gap-1.5 text-caption font-medium uppercase tracking-[0.6px] lg:gap-2">
          <li>
            <Link
              to="/admin"
              className="text-gray-500 hover:text-primary hover:underline"
            >
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true" className="tracking-normal text-gray-400">
            /
          </li>
          <li className="font-semibold text-gray-700" aria-current="page">
            Trash
          </li>
        </ol>
      </nav>

      <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          {/* Arbitrary type utilities, not the `.text-*` tokens — those are
              `@layer components`, so responsive variants of them emit no CSS. */}
          <h1 className="text-[2rem] font-semibold leading-10 text-text">Trash</h1>
          <p className="text-body text-text-secondary">
            Everything deleted across the business. Restore a record and it comes
            back exactly as it was.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 md:items-end">
          <p className="flex items-center gap-2 rounded-input border border-gray-200 bg-gray-50 px-3 py-2 text-small text-gray-500">
            <Trash2
              className="size-4 shrink-0 text-gray-400"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {!purgeEnabled
              ? 'Automatic deletion is paused — nothing here is being destroyed'
              : retentionDays === null
                ? 'Deleted records are kept for a limited time'
                : `Kept for ${retentionDays} day${retentionDays === 1 ? '' : 's'}, then permanently deleted`}
          </p>

          {onEditRetention ? (
            <button
              type="button"
              onClick={onEditRetention}
              className="flex h-10 items-center gap-2 self-start rounded-control border border-gray-200 bg-white px-4 text-body font-semibold text-text transition-colors hover:bg-gray-50 md:self-end focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Settings2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Retention
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
