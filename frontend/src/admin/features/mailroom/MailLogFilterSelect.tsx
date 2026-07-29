import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/*
 * One of the log's two filter selects — "Date range" and "Request type".
 *
 * The links only draw these closed, so the open panel is our design (Design.md):
 * a card-radius panel on a `shadow-lg-elevation`, anchored under the trigger and
 * at least as wide as it, listing the options with a check against the selected
 * one. Built rather than a native `<select>` so the panel matches the rest of
 * the admin chrome — the same call `OrderFilterDropdown` makes in the orders
 * feature, which this cannot import from (AGENTS.md — features never cross).
 *
 * The first option is the pass-through: its label is the control's resting
 * caption ("Date range"), and selecting anything else tints the trigger so an
 * active filter is visible without opening it.
 *
 * Behaviour: click-away and Escape close it, focus returns to the trigger on
 * Escape, and the trigger reads as a real combobox with the list as a `listbox`.
 */

type MailLogFilterOption<T extends string> = {
  value: T;
  label: string;
};

type MailLogFilterSelectProps<T extends string> = {
  label: string; // accessible name, e.g. "Date range"
  options: MailLogFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function MailLogFilterSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: MailLogFilterSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const isFiltered = Boolean(value) && value !== options[0]?.value;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-input border bg-white px-3 text-small transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:h-10 md:px-3.5 md:text-body ${
          open || isFiltered
            ? 'border-primary font-medium text-primary'
            : 'border-gray-300 text-text hover:bg-gray-50'
        }`}
      >
        <span className="truncate">{selected?.label ?? label}</span>
        <ChevronDown
          className={`size-3 shrink-0 transition-transform md:size-4 ${
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
          className="absolute left-0 top-full z-30 mt-2 max-h-[17.5rem] w-full min-w-[11.25rem] overflow-y-auto rounded-card border border-gray-200 bg-white p-1.5 shadow-lg-elevation"
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
