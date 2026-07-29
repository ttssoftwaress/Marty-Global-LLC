import { Download } from 'lucide-react';

/*
 * The screen's header — breadcrumb, title, subtitle, and the export control.
 *
 * The three links differ only in how the export button sits: desktop and tablet
 * keep it on the title's right (tablet shortens the label to "Export"), mobile
 * drops it full-width under the subtitle. One tree covers all three — the button
 * is `w-full` in the mobile column direction and shrinks back onto the row at
 * `md`.
 *
 * Copy comes from the desktop link (Design.md): the label stays "Export records"
 * at every width rather than adopting tablet's shortened "Export", and the
 * breadcrumb — which only the desktop and tablet links draw — is hidden on
 * mobile rather than reworded.
 */

type PaymentsHeaderProps = {
  onExport?: () => void;
  isExporting?: boolean;
};

export function PaymentsHeader({ onExport, isExporting }: PaymentsHeaderProps) {
  return (
    <header className="flex w-full flex-col gap-3">
      <p className="hidden text-caption font-medium uppercase tracking-[0.4px] text-gray-500 md:block">
        Dashboard / Quotes &amp; payments
      </p>

      <div className="flex w-full flex-col items-start gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[1.75rem] font-semibold leading-9 text-text lg:text-[2rem] lg:leading-10">
            Quotes &amp; payments
          </h1>
          <p className="text-[0.8125rem] leading-5 text-gray-500 md:text-body">
            Track quotes, payments, and revenue across all customers
          </p>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-control border border-primary bg-white px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white md:w-auto md:px-5 lg:h-input lg:text-body-lg"
        >
          <Download className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {isExporting ? 'Preparing…' : 'Export records'}
        </button>
      </div>
    </header>
  );
}
