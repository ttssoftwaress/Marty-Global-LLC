import { Plus } from 'lucide-react';

/*
 * The screen's header — breadcrumb, title, subtitle, and the "Add service"
 * control.
 *
 * One tree covers all three links. The breadcrumb is drawn by the desktop and
 * tablet links only, so it is hidden on mobile rather than reworded. The button
 * is full-width under the subtitle on mobile (matching how every other admin
 * screen drops its primary action there) and shrinks back onto the title row
 * at `md`.
 *
 * Copy is the desktop link's (Design.md): the subtitle reads "…what each service
 * includes…" at every width, so mobile's "…what each service dictates…" — which
 * reads like a typo of the same sentence — is not reproduced.
 *
 * The add control is not in any of the three links. The task asks for a way to
 * add a service, and the header is where every other admin screen puts its
 * primary action, so it sits beside the title. Logged as a deviation.
 */

type CatalogHeaderProps = {
  onAddService: () => void;
};

export function CatalogHeader({ onAddService }: CatalogHeaderProps) {
  return (
    <header className="flex w-full flex-col gap-3">
      <p className="hidden text-caption font-medium uppercase tracking-[0.4px] text-gray-500 md:block">
        Dashboard / Service catalog
      </p>

      <div className="flex w-full flex-col items-start gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[1.75rem] font-semibold leading-9 text-text lg:text-[2rem] lg:leading-10">
            Service catalog &amp; pricing
          </h1>
          <p className="text-[0.8125rem] leading-5 text-gray-500 md:text-body">
            Manage what each service includes, where it&rsquo;s offered, and how
            it&rsquo;s priced.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddService}
          className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-4 text-body font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:w-auto md:px-5 lg:h-input lg:text-body-lg"
        >
          <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Add service
        </button>
      </div>
    </header>
  );
}
