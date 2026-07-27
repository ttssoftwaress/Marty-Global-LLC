import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/*
 * The dialog shell the team screen's forms render inside — the add-staff form
 * and the delete confirmation both use it, so the two read as the same control.
 *
 * One component, two presentations: a bottom sheet that rises from the bottom
 * edge on mobile, and a centred modal from `md` up. Both are the same element —
 * mobile pins it to the bottom with only its top corners rounded, and `md`
 * releases it to the centre of the viewport — so the form inside is written
 * once.
 *
 * The header and footer are fixed and the body between them scrolls, which is
 * what keeps a long form usable inside a sheet capped at 92dvh.
 *
 * Standard dialog behaviour, none of which the design covers (Design.md, filling
 * in states the design did not cover): Escape and the backdrop close it, body
 * scroll is locked while it is up, focus moves into the panel on open and
 * returns to whatever opened it on close, and focus is trapped inside while it
 * is open.
 *
 * This mirrors `catalog/ServiceFormDialog`. The two are not shared because the
 * areas never import from each other's features — the same rule the rest of the
 * admin portal follows.
 */

type AddStaffDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  footer: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AddStaffDialog({
  open,
  title,
  description,
  footer,
  onClose,
  children,
}: AddStaffDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // `onClose` is a fresh closure on every render of the page holding the form's
  // draft, so it can't be an effect dependency: the effect would tear down and
  // re-run on every keystroke, pulling focus out of the field being typed in and
  // onto the panel's first focusable. The ref keeps the latest handler while the
  // effect stays tied to `open` alone.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      // The length check above guarantees both, which the index signature can't
      // express under `noUncheckedIndexedAccess`.
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    panelRef.current
      ?.querySelector<HTMLElement>(FOCUSABLE)
      ?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      restoreFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-gray-900/40"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-modal bg-white shadow-lg-elevation md:max-h-[86dvh] md:max-w-[680px] md:rounded-modal lg:max-w-[720px]"
      >
        {/* The grabber reads as "drag me down", so it is mobile-only. */}
        <div className="flex justify-center pb-1 pt-3 md:hidden">
          <span aria-hidden="true" className="h-1 w-9 rounded-pill bg-gray-300" />
        </div>

        <header className="flex shrink-0 items-start gap-4 px-4 pb-4 pt-2 md:border-b md:border-gray-200 md:px-6 md:pt-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-h5 font-semibold text-text md:text-h6">{title}</h2>
            {description ? (
              <p className="text-caption text-gray-500 md:text-body">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-100 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-6 md:py-6">
          {children}
        </div>

        {/* Footer clears the home indicator on mobile. */}
        <div className="shrink-0 border-t border-gray-200 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-5">
          {footer}
        </div>
      </div>
    </div>
  );
}
