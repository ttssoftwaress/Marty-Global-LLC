import { Link } from 'react-router-dom';

/*
 * The screen's save/cancel actions.
 *
 * All three links draw these differently, and each difference is real rather
 * than an artifact, so all three are reproduced:
 *   - desktop: right-aligned at the end of the content, Cancel as a bare text
 *     control beside the navy Save
 *   - tablet:  the same row, but Cancel is an outlined navy button — at that
 *     width the pair reads as two buttons rather than a link and a button
 *   - mobile:  a bar pinned to the bottom of the viewport, Cancel on the left
 *     and Save taking the rest of the row
 *
 * Cancel is a `<Link>` back to the list rather than a history pop, so the
 * destination is the same on a deep link as it is mid-session.
 */

type EditMemberFooterProps = {
  cancelTo: string;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
};

export function EditMemberFooter({
  cancelTo,
  canSave,
  isSaving,
  onSave,
}: EditMemberFooterProps) {
  const saveLabel = isSaving ? 'Saving…' : 'Save changes';
  const saveDisabled = !canSave || isSaving;

  return (
    <>
      {/* Tablet & desktop — inline at the end of the content. */}
      <div className="hidden w-full items-center justify-end gap-4 md:flex lg:gap-5">
        {/* Tablet draws Cancel as an outlined button; desktop as bare text. */}
        <Link
          to={cancelTo}
          className="flex h-input items-center justify-center rounded-control border border-primary bg-white px-6 text-button text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:h-auto lg:border-transparent lg:bg-transparent lg:px-0 lg:font-medium lg:text-gray-500 lg:hover:bg-transparent lg:hover:text-text"
        >
          Cancel
        </Link>

        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className="flex h-input items-center justify-center rounded-control bg-primary px-6 text-button text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {saveLabel}
        </button>
      </div>

      {/* Mobile — the bar pinned to the bottom of the viewport. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-4 border-t border-gray-200 bg-white px-4 pb-6 pt-4 shadow-footer-raised md:hidden">
        <Link
          to={cancelTo}
          className="shrink-0 rounded-input px-2 py-1 text-[15px] font-medium leading-5 text-text-secondary transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancel
        </Link>

        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className="flex h-input min-w-0 flex-1 items-center justify-center rounded-control bg-primary px-6 text-button text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {saveLabel}
        </button>
      </div>
    </>
  );
}
