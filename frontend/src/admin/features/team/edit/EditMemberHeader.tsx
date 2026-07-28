import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/*
 * The chrome above the two cards: the crumb trail, the back link, and the page
 * titles.
 *
 * The links split at `md`. Tablet and desktop carry the full
 * DASHBOARD / TEAM & STAFF / EDIT MEMBER trail with the "← Back to team & staff"
 * link beneath it; mobile drops the trail — three crumbs wrap at that width —
 * for a single back row reading "Team & staff", which is the same destination.
 *
 * The desktop link paints the first two crumbs navy and the tablet link paints
 * them gray. Two colours for one trail at two widths is a design artifact rather
 * than a distinction worth reproducing, so both use the gray/hover-navy trail
 * the customer-detail screen already established — logged as a deviation.
 *
 * The trailing crumb is not a link and is marked `aria-current`, so the trail
 * announces where the page sits.
 */

const TEAM_ROUTE = '/admin/team';

export function EditMemberHeader() {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-3 lg:gap-4">
      {/* Mobile — a back control instead of the trail. */}
      <Link
        to={TEAM_ROUTE}
        className="-ml-1 flex items-center gap-2 self-start rounded-input px-1 py-1 text-body font-medium text-primary transition-colors hover:text-primary-hover md:hidden"
      >
        <ArrowLeft className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Team &amp; staff
      </Link>

      {/* Tablet & desktop — the full trail, then the back link. */}
      <div className="hidden flex-col gap-3 md:flex lg:gap-4">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.6px] lg:gap-2">
            <li>
              <Link
                to="/admin"
                className="text-gray-400 transition-colors hover:text-primary hover:underline"
              >
                Dashboard
              </Link>
            </li>
            <li aria-hidden="true" className="font-normal tracking-normal text-gray-400">
              /
            </li>
            <li>
              <Link
                to={TEAM_ROUTE}
                className="text-gray-400 transition-colors hover:text-primary hover:underline"
              >
                Team &amp; staff
              </Link>
            </li>
            <li aria-hidden="true" className="font-normal tracking-normal text-gray-400">
              /
            </li>
            <li className="text-gray-500" aria-current="page">
              Edit member
            </li>
          </ol>
        </nav>

        <Link
          to={TEAM_ROUTE}
          className="self-start rounded-input text-body font-medium text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ← Back to team &amp; staff
        </Link>
      </div>

      <div className="flex w-full flex-col gap-1.5">
        <h1 className="text-[1.5rem] font-semibold leading-[2rem] text-text md:text-[2rem] md:leading-[2.5rem]">
          Edit team member
        </h1>
        <p className="text-body leading-[1.4] text-text-secondary">
          Modify account details, roles, and administrative access privileges.
        </p>
      </div>
    </div>
  );
}
