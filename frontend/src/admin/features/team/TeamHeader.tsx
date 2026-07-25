import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

/*
 * The Team & staff page header — breadcrumb, title block, and the invite action.
 *
 * The three links arrange the same parts differently, which one tree covers:
 *   - desktop & tablet: the title block and the invite button share one row
 *   - mobile:           the breadcrumb and the subtitle drop away and the button
 *                       becomes a full-width bar under the title
 *
 * The invite button carries the desktop link's navy fill at every width. The
 * tablet link draws it magenta — reproduced as navy here and logged as a
 * deviation: the accent is the marketing CTA colour, and every other primary
 * action in the admin portal is navy, so a magenta button on one breakpoint only
 * would read as a different control.
 */

type TeamHeaderProps = {
  onInvite: () => void;
};

export function TeamHeader({ onInvite }: TeamHeaderProps) {
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
            Team &amp; staff
          </li>
        </ol>
      </nav>

      <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[32px] font-semibold leading-10 text-text">
            Team &amp; staff
          </h1>
          {/* The mobile link drops the subtitle; it is kept at every width so the
              screen explains itself on a phone too (Design.md, improving where
              warranted — logged as a deviation). */}
          <p className="text-body text-text-secondary">
            Manage your internal team, their roles, and what they can access.
          </p>
        </div>

        <button
          type="button"
          onClick={onInvite}
          // Type sizes are arbitrary utilities, not the `.text-*` tokens: those
          // are `@layer components`, so their responsive variants emit no CSS.
          className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-5 text-[16px] font-semibold leading-6 text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:h-10 md:w-auto md:gap-1.5 md:px-4 md:text-[14px] md:leading-5 lg:h-12 lg:gap-2 lg:px-5 lg:text-[16px] lg:leading-6"
        >
          <Plus
            className="size-5 shrink-0 md:size-4 lg:size-5"
            strokeWidth={2}
            aria-hidden="true"
          />
          Invite team member
        </button>
      </div>
    </div>
  );
}
