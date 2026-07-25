import { Link } from 'react-router-dom';

/*
 * The screen's save/cancel actions.
 *
 * Desktop and tablet put them inline at the end of the page, right-aligned. On
 * mobile they live in a sticky bar pinned to the bottom of the viewport, which
 * is what the mobile link draws — so the page reserves a matching spacer beneath
 * its content and the bar overlays it.
 *
 * Cancel is a `<Link>` back to the catalog rather than a history pop, so the
 * destination is the same on a deep link as it is mid-session.
 */

type ServiceDetailFooterProps = {
  cancelTo: string;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
};

export function ServiceDetailFooter({
  cancelTo,
  canSave,
  isSaving,
  onSave,
}: ServiceDetailFooterProps) {
  return (
    <>
      {/* Tablet & desktop — inline at the end of the content. */}
      <div className="hidden w-full items-center justify-end gap-4 pt-4 md:flex">
        <Link
          to={cancelTo}
          className="flex h-10 items-center justify-center rounded-control px-6 text-body font-medium text-gray-500 transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancel
        </Link>

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="flex h-10 items-center justify-center rounded-control bg-primary px-6 text-body font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 lg:h-input lg:text-button"
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Mobile — sticky bar over the content. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex h-[72px] items-center justify-between gap-4 border-t border-gray-200 bg-white px-4 shadow-footer-raised md:hidden">
        <Link
          to={cancelTo}
          className="text-body font-medium text-gray-500 transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancel
        </Link>

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="flex h-input w-[240px] max-w-[60%] items-center justify-center rounded-control bg-primary px-6 text-button text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </>
  );
}
