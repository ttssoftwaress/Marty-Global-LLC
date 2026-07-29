import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

/*
 * The audit log page header — breadcrumb, title block, and the read-only notice.
 *
 * There is no action button here, unlike every other admin list header, and its
 * absence is the design: the trail is written by the system and never edited
 * from a screen, so there is nothing on this page to add, export, or clear. The
 * notice says so outright rather than leaving an admin hunting for a control
 * that does not exist.
 *
 * The breadcrumb and subtitle drop away on mobile, matching the rest of the
 * admin portal's headers.
 */

export function AuditHeader() {
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
            Audit log
          </li>
        </ol>
      </nav>

      <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          {/* Arbitrary type utilities, not the `.text-*` tokens — those are
              `@layer components`, so responsive variants of them emit no CSS. */}
          <h1 className="text-[2rem] font-semibold leading-10 text-text">
            Audit log
          </h1>
          <p className="text-body text-text-secondary">
            Every recorded action across the business — who did it, what it
            touched, and when.
          </p>
        </div>

        <p className="flex shrink-0 items-center gap-2 rounded-input border border-gray-200 bg-gray-50 px-3 py-2 text-small text-gray-500">
          <ShieldCheck
            className="size-4 shrink-0 text-gray-400"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          Read-only — entries cannot be edited or removed
        </p>
      </div>
    </div>
  );
}
