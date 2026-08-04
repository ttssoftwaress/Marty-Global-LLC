import { Mail, ScanLine } from 'lucide-react';

/*
 * The preview shown in the inbox table's first column — what stage the piece of
 * mail is at, at a glance:
 *   - ready:     a small document mock (CSS bars only — the Figma icon/mock is a
 *                reference, never an exported asset, Design guide) so a scanned
 *                item reads as a page
 *   - requested: the customer has asked us to open the envelope and we haven't
 *                yet
 *   - sealed:    the envelope has arrived and nobody has opened it
 *
 * The unopened states used to share one "Scanning" placeholder, which was
 * accurate when every item was filed already scanned. Under the envelope-first
 * flow it was the common state and it said the wrong thing: nothing is scanning,
 * and the customer is the one who decides whether it ever does.
 *
 * Sized for the table (smaller on tablet, larger on desktop); the mobile card
 * uses its own plain thumbnail, matching that link.
 */

export function ScanThumbnail({
  ready,
  scanRequested = false,
}: {
  ready: boolean;
  scanRequested?: boolean;
}) {
  const box =
    'h-12 w-9 shrink-0 rounded-[0.25rem] border border-gray-200 lg:h-[3.25rem] lg:w-10';

  if (!ready) {
    const { icon: Icon, label, tone } = scanRequested
      ? { icon: ScanLine, label: 'Scanning', tone: 'text-primary' }
      : { icon: Mail, label: 'Sealed', tone: 'text-gray-400' };

    return (
      <div
        role="img"
        aria-label={scanRequested ? 'Scan requested' : 'Envelope not opened yet'}
        className={`${box} flex flex-col items-center justify-center gap-1 ${
          scanRequested ? 'bg-primary-light' : 'bg-gray-100'
        }`}
      >
        <Icon className={`size-3.5 ${tone}`} strokeWidth={1.75} aria-hidden="true" />
        <span className={`text-[0.5rem] font-medium leading-none ${tone}`}>
          {label}
        </span>
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
