import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/*
 * The select the two order actions use. Built rather than a native `<select>`
 * for the same reason the queue's filter dropdown is — the panel has to match
 * the admin chrome, and an option here carries a second line (the staff member's
 * job role) that a native option cannot show.
 *
 * The one thing it does that the queue's dropdown does not is render an option
 * as unreachable. A status outside the pipeline is drawn dimmed and unclickable
 * rather than hidden, so the whole flow stays visible and it is obvious that the
 * step exists but is not this order's next one.
 *
 * Behaviour: click-away and Escape close the panel, Escape returns focus to the
 * trigger, and the trigger reads as a combobox with the panel as its listbox.
 */

export type ActionSelectOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

type ActionSelectProps = {
  label: string;
  options: ActionSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function ActionSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: ActionSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const labelId = useId();

  const selected = options.find((option) => option.value === value);

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

  // A closed panel must not survive the control going disabled mid-flight (the
  // card disables both selects while a save is in the air).
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className="flex w-full flex-col gap-1.5">
      <span id={labelId} className="text-small font-semibold text-gray-600">
        {label}
      </span>

      <div ref={containerRef} className="relative w-full">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => setOpen((isOpen) => !isOpen)}
          className={`flex h-11 w-full items-center justify-between gap-2 rounded-input border bg-white px-4 text-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 ${
            open ? 'border-primary font-medium text-primary' : 'border-gray-300 text-text hover:bg-gray-50'
          }`}
        >
          <span className="truncate">{selected?.label ?? label}</span>
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            className="absolute left-0 top-full z-30 mt-2 max-h-[280px] w-full overflow-y-auto rounded-card border border-gray-200 bg-white p-1.5 shadow-lg-elevation"
          >
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <li key={option.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-input px-2.5 py-2 text-left transition-colors ${
                      option.disabled
                        ? 'cursor-not-allowed text-gray-300'
                        : isSelected
                          ? 'bg-primary-light font-semibold text-primary'
                          : 'font-medium text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body">{option.label}</span>
                      {option.hint ? (
                        <span className="truncate text-small font-normal text-gray-400">
                          {option.hint}
                        </span>
                      ) : null}
                    </span>

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
    </div>
  );
}
