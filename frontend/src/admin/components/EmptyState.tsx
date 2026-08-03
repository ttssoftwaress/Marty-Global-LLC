import type { LucideIcon } from 'lucide-react';

/*
 * What a list shows once a query resolves with nothing to render (Design.md —
 * every screen that fetches owes an empty state, and it must be distinguishable
 * from a failed one; `DataErrorState` is its counterpart).
 *
 * One component rather than one per screen: five admin screens had drawn the
 * same icon-disc / title / sentence / optional-action shape independently, and
 * they had already drifted into two heading sizes and two description widths.
 * Duplication inside one area is what Design.md asks to extract, so the shape
 * lives here and each screen keeps only its copy — which is the part that
 * genuinely differs, because the words must say whether the list is empty or
 * the filters are.
 *
 * The action is a prop rather than a slot so its two shapes stay consistent:
 * `outline` for the escape hatch out of a filter ("Clear filters"), `primary`
 * for the one thing that would populate an empty screen ("Add service").
 */

type EmptyStateAction = {
  label: string;
  onClick: () => void;
  variant?: 'outline' | 'primary';
  icon?: LucideIcon;
};

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
};

const ACTION_STYLES = {
  outline:
    'mt-1 border border-primary bg-white text-primary hover:bg-primary-light',
  primary: 'mt-2 bg-primary text-white hover:bg-primary-hover',
} as const;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    /* Fades in rather than replacing the skeleton instantly — the swap from
     * loading to "nothing here" is otherwise a flash the eye reads as a glitch. */
    <div
      className={`flex w-full animate-fade-in flex-col items-center gap-3 px-6 py-14 text-center motion-reduce:animate-none ${className}`}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-h6 text-text">{title}</p>
        <p className="max-w-[26.25rem] text-body text-gray-500">{description}</p>
      </div>

      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className={`flex h-10 items-center gap-2 rounded-control px-4 text-body font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            ACTION_STYLES[action.variant ?? 'outline']
          }`}
        >
          {ActionIcon ? (
            <ActionIcon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          ) : null}
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
