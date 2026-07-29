import { Info } from 'lucide-react';

/*
 * The info affordance beside the "Storage expires" column header. The tablet
 * link shows the tooltip open; this wires it as a real hover/focus tooltip so
 * the explanation is reachable by pointer and keyboard, not just decorative.
 */

export function StorageExpiryInfo() {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="What does storage expiry mean?"
        className="inline-flex items-center text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:text-primary"
      >
        <Info className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      </button>

      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-[15rem] -translate-x-1/2 rounded-[0.75rem] border border-gray-200 bg-white p-3 opacity-0 shadow-md-elevation transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="block text-caption font-semibold uppercase tracking-[0.4px] text-primary">
          Storage expiry
        </span>
        <span className="mt-1.5 block text-small normal-case leading-4 text-gray-600">
          Physical items are securely shredded on this date unless you request
          forwarding.
        </span>
      </span>
    </span>
  );
}
