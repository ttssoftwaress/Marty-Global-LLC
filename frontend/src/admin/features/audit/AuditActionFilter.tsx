import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { useDismissablePopover } from '../../hooks/useDismissablePopover';
import { ALL_ACTIONS, type AuditActionOption } from '../../types/audit';

/*
 * The action filter — narrows the trail to a single event kind
 * ("Sign-in failed", "Staff role or access changed").
 *
 * A non-modal popover, so it deliberately does NOT use `useOverlay` (Design.md):
 * it closes on Escape and outside click, returns focus to its trigger, and
 * leaves page scroll and Tab alone. Same pattern as the team screen's role
 * filter and the orders queue's status menu.
 *
 * Two things it does that those do not, both because the list is long — roughly
 * sixty actions rather than five:
 *
 *   - it filters as you type, so an admin can reach "Payment amount mismatched"
 *     without scrolling past the whole catalogue
 *   - options are grouped under their category heading, so the same action
 *     sits where the category tabs would have put it
 *
 * The options themselves are the backend's, so a newly audited event appears
 * here with no change to this file.
 */

type AuditActionFilterProps = {
  options: AuditActionOption[];
  categories: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function AuditActionFilter({
  options,
  categories,
  value,
  onChange,
  className,
}: AuditActionFilterProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const isFiltered = value !== ALL_ACTIONS;

  useDismissablePopover({
    open,
    onClose: () => setOpen(false),
    containerRef,
    triggerRef,
  });

  // The type-ahead resets each time the panel opens, so reopening never starts
  // mid-search from a previous visit.
  useEffect(() => {
    if (!open) setFilter('');
  }, [open]);

  const needle = filter.trim().toLowerCase();
  const matching = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  // Category headings, in the backend's own order, over the options that
  // survived the type-ahead. A category with nothing matching is dropped rather
  // than printed empty.
  const groups = categories
    .filter((category) => category.value !== 'all')
    .map((category) => ({
      label: category.label,
      options: matching.filter((option) => option.category === category.value),
    }))
    .filter((group) => group.options.length > 0);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label="Action"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`flex h-input w-full items-center justify-between gap-2 rounded-control border bg-white px-4 text-body font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          open || isFiltered
            ? 'border-primary text-primary'
            : 'border-gray-300 text-text hover:bg-gray-50'
        }`}
      >
        <span className="truncate">{selected?.label ?? 'All actions'}</span>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 flex w-full min-w-[16rem] flex-col rounded-card border border-gray-200 bg-white shadow-lg-elevation">
          <div className="border-b border-gray-200 p-2">
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter actions…"
              aria-label="Filter the action list"
              // Focusing on mount is what makes the type-ahead usable without a
              // second click. Safe here in a way it would not be in a modal:
              // the popover opens from a deliberate press, never on page load.
              autoFocus
              className="h-9 w-full rounded-input border border-gray-300 bg-white px-3 text-body text-text outline-none transition-colors focus:border-primary placeholder:text-gray-400"
            />
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label="Action"
            className="max-h-[17.5rem] overflow-y-auto p-1.5"
          >
            <li role="none">
              <button
                type="button"
                role="option"
                aria-selected={value === ALL_ACTIONS}
                onClick={() => pick(ALL_ACTIONS)}
                className={`flex w-full items-center justify-between gap-2 rounded-input px-2.5 py-2 text-left text-body transition-colors ${
                  value === ALL_ACTIONS
                    ? 'bg-primary-light font-semibold text-primary'
                    : 'font-medium text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">All actions</span>
                {value === ALL_ACTIONS ? (
                  <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                ) : null}
              </button>
            </li>

            {groups.length === 0 ? (
              <li className="px-2.5 py-3 text-small text-gray-500">
                No actions match “{filter.trim()}”.
              </li>
            ) : (
              groups.map((group) => (
                <li key={group.label} role="none">
                  <p
                    // A heading inside a listbox is presentational — the options
                    // themselves carry the semantics.
                    role="presentation"
                    className="px-2.5 pb-1 pt-3 text-caption font-semibold uppercase tracking-[0.6px] text-gray-400"
                  >
                    {group.label}
                  </p>

                  <ul role="none">
                    {group.options.map((option) => {
                      const isSelected = option.value === value;

                      return (
                        <li key={option.value} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => pick(option.value)}
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
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
