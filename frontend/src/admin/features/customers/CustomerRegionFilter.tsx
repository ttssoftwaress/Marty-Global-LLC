import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import type { CustomerRegionOption } from '../../types/customers';

/*
 * The region filter — the "Region: All regions" control every link shows beside
 * the search field.
 *
 * The links only show it closed, so the open panel is our design (per Design.md,
 * filling in a state the design did not cover): a card-radius panel on a
 * `shadow-lg-elevation`, anchored under the trigger, listing the regions with a
 * check against the selected one. It is built rather than a native `<select>` so
 * the panel matches the rest of the admin chrome — the same call the orders
 * queue's filter dropdowns made.
 *
 * Behaviour: click-away and Escape close it, focus returns to the trigger on
 * Escape, and the trigger reads as a real combobox. Picking a region other than
 * the pass-through tints the closed control, so an active filter is visible
 * without opening it.
 *
 * The trigger prints the design's "Region: <selection>" prefix; the accessible
 * name stays plain so a screen reader announces the control once, not twice.
 */

type CustomerRegionFilterProps = {
  options: CustomerRegionOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function CustomerRegionFilter({
  options,
  value,
  onChange,
  className,
}: CustomerRegionFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  // The first option is the pass-through ("All regions"); anything else is a
  // narrowed filter worth flagging on the closed control.
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
        aria-label="Region"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-input border bg-white px-4 text-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:h-[2.375rem] md:px-3 md:text-[0.8125rem] lg:h-10 lg:px-4 lg:text-body ${
          open || isFiltered
            ? 'border-primary font-medium text-primary'
            : 'border-gray-300 text-text hover:bg-gray-50 md:border-gray-200 lg:border-gray-300'
        }`}
      >
        <span className="truncate">
          Region: {selected?.label ?? 'All regions'}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform md:size-3.5 lg:size-4 ${
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
          aria-label="Region"
          className="absolute left-0 top-full z-30 mt-2 max-h-[17.5rem] w-full min-w-[12.5rem] overflow-y-auto rounded-card border border-gray-200 bg-white p-1.5 shadow-lg-elevation"
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
                    <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
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
