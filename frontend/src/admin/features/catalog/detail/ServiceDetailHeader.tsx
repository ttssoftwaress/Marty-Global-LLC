import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/*
 * The service-detail screen's header — breadcrumbs, back control, title, and the
 * header Save action.
 *
 * The three links diverge most here, so this is where the responsive work sits:
 *
 *   - desktop / tablet: a breadcrumb trail above a row holding the round back
 *     button, the title, and Save on the right. The title steps 32px → 24px.
 *   - mobile: no breadcrumbs and no header Save. Instead a full-width bar with a
 *     back arrow and "Service catalog", then the title below it on the page.
 *     Save lives in the sticky bottom bar (see ServiceDetailFooter).
 *
 * The back control is a real `<Link>` to the catalog list at every width rather
 * than a history-popping button, so the destination is predictable on a deep
 * link and the browser gets a real href to open in a new tab.
 */

type ServiceDetailHeaderProps = {
  title: string;
  backTo: string;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
};

export function ServiceDetailHeader({
  title,
  backTo,
  canSave,
  isSaving,
  onSave,
}: ServiceDetailHeaderProps) {
  return (
    <>
      {/* Mobile — the back row is the screen's top chrome, full-bleed against
          the page padding so it spans edge to edge like the design. */}
      <div className="-mx-4 -mt-4 mb-2 flex h-12 items-center gap-2 border-b border-gray-200 bg-white px-4 md:hidden">
        <Link
          to={backTo}
          className="flex items-center gap-2 text-body font-medium text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeft
            className="size-[1.125rem] shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          Service catalog
        </Link>
      </div>

      {/* Tablet & desktop — breadcrumb trail. */}
      <nav
        aria-label="Breadcrumb"
        className="hidden items-center gap-2 text-caption font-medium uppercase md:flex"
      >
        <Link
          to="/admin"
          className="text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Dashboard
        </Link>
        <span aria-hidden="true" className="text-gray-400">
          /
        </span>
        <Link
          to={backTo}
          className="text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Service Catalog
        </Link>
        <span aria-hidden="true" className="text-gray-400">
          /
        </span>
        <span aria-current="page" className="text-gray-500">
          {title}
        </span>
      </nav>

      <header className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 lg:gap-4">
          {/* The round back button belongs to the wider links; mobile has the
              back row above instead. */}
          <Link
            to={backTo}
            aria-label="Back to service catalog"
            className="hidden size-10 shrink-0 items-center justify-center rounded-modal border border-gray-200 bg-white text-text transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:flex lg:border-primary lg:text-primary"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </Link>

          <h1 className="min-w-0 text-[1.5rem] font-semibold leading-[1.2] text-text md:text-gray-900 lg:text-[2rem] lg:leading-[normal]">
            {title}
          </h1>
        </div>

        {/* Mobile's Save lives in the sticky footer, so the header keeps it from
            `md` up only. */}
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="hidden h-10 shrink-0 items-center justify-center rounded-control bg-primary px-5 text-body font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 md:flex"
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </header>
    </>
  );
}
