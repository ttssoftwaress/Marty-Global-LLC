import { useEffect, useRef } from 'react';

/*
 * The tick box in a selectable list — one per row, plus the header's
 * select-all.
 *
 * A real `<input type="checkbox">` rather than a styled `div` (Design.md:
 * interactive elements are real controls). The native box carries the checked
 * state, the keyboard behaviour, and — the part a div cannot fake — the
 * `indeterminate` flag the header needs when only some rows are ticked, which is
 * a DOM property rather than an attribute and so has to be set on the node.
 *
 * `label` is required and never rendered. A column of boxes with no accessible
 * name announces as twenty-five identical "checkbox"es, which is the same as
 * having none; every caller passes the row's own name.
 */

type RowCheckboxProps = {
  checked: boolean;
  onChange: () => void;
  label: string;
  indeterminate?: boolean;
  className?: string;
};

export function RowCheckbox({
  checked,
  onChange,
  label,
  indeterminate = false,
  className = '',
}: RowCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      /*
       * `accent-primary` tints the native control, which keeps the platform's
       * own checked and indeterminate glyphs instead of redrawing them — and the
       * indeterminate dash in particular is not something a custom box gets
       * right for free.
       *
       * The click target is padded out to 2.5rem via the surrounding cell in
       * each list; the box itself stays visually 1rem, which is what the tables
       * are drawn at.
       */
      className={`size-4 shrink-0 cursor-pointer rounded border-gray-300 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
      /* The row underneath is usually a link or an expander; a tick must not
         also trigger it. */
      onClick={(event) => event.stopPropagation()}
    />
  );
}
