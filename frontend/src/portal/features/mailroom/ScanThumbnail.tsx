import { ScanLine } from 'lucide-react';

/*
 * The scan preview shown in the inbox table's first column. Until the backend
 * serves a real preview image (a short-TTL presigned URL after an ownership
 * check, AGENTS.md), this stands in for it:
 *   - ready:   a small document mock (CSS bars only — the Figma icon/mock is a
 *              reference, never an exported asset, Design guide) so a scanned
 *              item reads as a page at a glance
 *   - pending: a "Scanning" placeholder while the scan is still processing
 *
 * Sized for the table (smaller on tablet, larger on desktop); the mobile card
 * uses its own plain thumbnail, matching that link.
 */

export function ScanThumbnail({ ready }: { ready: boolean }) {
  const box = 'h-12 w-9 shrink-0 rounded-[0.25rem] border border-gray-200 lg:h-[3.25rem] lg:w-10';

  if (!ready) {
    return (
      <div
        role="img"
        aria-label="Scan in progress"
        className={`${box} flex flex-col items-center justify-center gap-1 bg-gray-100`}
      >
        <ScanLine className="size-3.5 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
        <span className="text-[0.5rem] font-medium leading-none text-gray-400">Scanning</span>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${box} flex flex-col gap-0.5 bg-white p-1 shadow-[0px_1px_0.5px_rgba(0,0,0,0.04)]`}
    >
      <div className="h-0.5 w-full bg-gray-200" />
      <div className="h-1 w-full bg-gray-200" />
      <div className="h-0.5 w-1/2 bg-gray-200" />
      <div className="mt-0.5 flex flex-col gap-0.5">
        <div className="h-px w-full bg-gray-100" />
        <div className="h-px w-2/3 bg-gray-100" />
        <div className="h-px w-full bg-gray-100" />
        <div className="h-px w-1/3 bg-gray-100" />
      </div>
    </div>
  );
}
