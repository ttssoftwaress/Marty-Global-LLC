import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

/*
 * The card every section of the service-detail screen sits in — white surface,
 * Gray-200 hairline, 16px radius, small elevation.
 *
 * The design draws the same card four times over, changing only its padding
 * across the three links (1.25rem mobile, 24px tablet and desktop), so it exists
 * once here rather than as a repeated class string in five files.
 */

type DetailCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function DetailCard({ title, description, children }: DetailCardProps) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-sm-elevation md:p-card">
      <div className="flex flex-col gap-2">
        <h2 className="text-h6 font-semibold text-gray-900">{title}</h2>
        {description ? (
          <p className="text-body leading-[1.5] text-gray-500">{description}</p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

/*
 * The dashed full-width "Add …" control the design uses to append a row.
 *
 * The desktop and mobile links draw it as a dashed 48px button; the tablet link
 * draws the same action as a bare centred link. Reproducing that difference
 * would make the same control look like two different affordances at one
 * breakpoint for no functional reason, so the dashed button is used at every
 * width — logged as a deviation.
 */
export function DashedAddButton({
  label,
  onClick,
  ref,
}: {
  label: string;
  onClick: () => void;
  /* Pickers refocus their trigger on Escape — see `ResultFieldPicker`. */
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex h-input w-full items-center justify-center gap-2 rounded-control border border-dashed border-gray-300 bg-white text-body font-medium text-primary transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  );
}
