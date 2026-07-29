import { useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { useDismissablePopover } from '../hooks/useDismissablePopover';

/*
 * The "All X" filter control every admin list screen puts beside its search
 * field — a button that reads as a combobox, and a panel of options with a check
 * against the selected one.
 *
 * Four screens had a byte-identical copy of it (orders, mail log, team,
 * customers). `useDismissablePopover` had already been hoisted out of them, but
 * the markup around the hook had not: the same `role="combobox"` trigger, the
 * same `role="listbox"` panel, the same "first option is the pass-through, so
 * anything else tints the closed control" rule. What actually differed was the
 * control's size and the caption it prints, which are the props below.
 *
 * `admin/components` rather than a feature, so every feature can import it —
 * the rule the copies cited (areas never import from each other) is about
 * marketing/portal/admin, not about features inside admin, and it is what
 * `RowActions` and `FormDialog` already do.
 *
 * It is built rather than a native `<select>` so the panel matches the rest of
 * the admin chrome. Deliberately NOT an overlay (Design.md): a non-modal popover
 * closes on Escape and outside click and returns focus to its trigger, but must
 * leave page scroll and Tab alone.
 *
 * A filter whose panel is genuinely a different shape still builds its own —
 * `audit/AuditActionFilter` adds a type-ahead and category headings over sixty
 * options, which is a different control rather than this one with a prop.
 */

export type FilterSelectOption<T extends string> = {
  value: T;
  label: string;
};

type FilterSelectProps<T extends string> = {
  label: string; // accessible name, e.g. "Date range"
  options: readonly FilterSelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Printed when no option matches `value`; defaults to the accessible name.
  placeholder?: string;
  // Printed before the caption, e.g. "Region: " — the accessible name stays
  // plain so a screen reader announces the control once, not twice.
  captionPrefix?: string;
  className?: string; // on the wrapper, for grid placement
  triggerClassName?: string; // height, padding, and type scale of the closed control
  restingClassName?: string; // its colours while closed and unfiltered
  chevronClassName?: string;
  panelClassName?: string; // the panel's minimum width
};

// `rounded-control` and `rounded-input` are the same 0.625rem token, so the
// copies' differing radius class was never a visual difference.
const TRIGGER_BASE =
  'flex w-full items-center justify-between gap-2 rounded-control border bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function FilterSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  captionPrefix,
  className,
  triggerClassName = 'h-input px-4 text-body',
  restingClassName = 'border-gray-300 text-text hover:bg-gray-50',
  chevronClassName = 'size-4',
  panelClassName = 'min-w-[12.5rem]',
}: FilterSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  // The first option is the pass-through ("All roles"); anything else is a
  // narrowed filter worth flagging on the closed control.
  const isFiltered = Boolean(value) && value !== options[0]?.value;

  useDismissablePopover({
    open,
    onClose: () => setOpen(false),
    containerRef,
    triggerRef,
  });

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`${TRIGGER_BASE} ${triggerClassName} ${
          open || isFiltered
            ? 'border-primary font-medium text-primary'
            : restingClassName
        }`}
      >
        <span className="truncate">
          {captionPrefix}
          {selected?.label ?? placeholder ?? label}
        </span>
        <ChevronDown
          className={`shrink-0 transition-transform ${chevronClassName} ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={`absolute left-0 top-full z-30 mt-2 max-h-[17.5rem] w-full overflow-y-auto rounded-card border border-gray-200 bg-white p-1.5 shadow-lg-elevation ${panelClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-input px-2.5 py-2 text-left text-body transition-colors ${
                    isSelected
                      ? 'bg-primary-light font-semibold text-primary'
                      : 'font-medium text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? (
                    <Check
                      className="size-4 shrink-0"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
