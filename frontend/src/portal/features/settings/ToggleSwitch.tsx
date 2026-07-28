/*
 * The pill toggle used across the notification matrix — a real `role="switch"`
 * button rather than a styled checkbox, so it carries its own checked state and
 * keyboard behaviour for free.
 *
 * The design draws two sizes of the same control: 38×20 on mobile and 44×24 on
 * tablet/desktop. One element renders both — the track/knob sizes swap at `md`
 * — so there is a single switch in the tree per cell.
 *
 * On = brand accent fill (the design drew navy; magenta is part of the
 * accent-visibility pass — logged as a deviation); off = Gray-300 track. The
 * knob is white in both states and slides on translate.
 */

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /* Announced to screen readers — the visible column headers are separate
   * elements, so each cell needs its own accessible name. */
  label: string;
  disabled?: boolean;
};

export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-[2.375rem] shrink-0 items-center rounded-pill transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:h-6 md:w-11 ${
        checked ? 'bg-accent' : 'bg-gray-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm-elevation transition-transform md:size-5 ${
          checked
            ? 'translate-x-[1.25rem] md:translate-x-[1.375rem]'
            : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
