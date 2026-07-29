/*
 * The pill toggle the "Supported regions" rows use — a real `role="switch"`
 * button rather than a styled checkbox, so it carries its own checked state and
 * keyboard behaviour for free.
 *
 * All three links draw the same 44×24 track, so unlike the portal's variant this
 * one has a single size. The portal has an equivalent control; the two areas
 * never import from each other (AGENTS.md, route-group rule), so admin keeps its
 * own copy rather than reaching across.
 */

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  // Announced to screen readers — the visible region name is a separate element,
  // so each switch needs its own accessible name.
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
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        checked ? 'bg-accent' : 'bg-gray-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm-elevation transition-transform ${
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
