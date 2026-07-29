import { useEffect, useRef, type RefObject } from 'react';

/*
 * The dismissal behaviour every non-modal popover in the admin portal shares —
 * the filter dropdowns, the status and assignee menus, the order-action select.
 *
 * Design.md draws the line: modal dialogs and slide-overs use `useOverlay`
 * (focus trap, scroll lock, `aria-modal`); a popover deliberately does none of
 * that. It closes on outside pointer-down and on Escape, and Escape returns
 * focus to the trigger rather than stranding it on a list that is unmounting.
 * Page scroll and Tab are left alone.
 *
 * That is a ~15-line effect that had been hand-written eight times. It is one
 * effect now for the same reason `useOverlay` is one hook: copies drift, and a
 * popover that forgets to return focus is only noticed by someone using the
 * keyboard.
 *
 * `containerRef` wraps trigger *and* panel — a press inside either is not an
 * outside click. Pointer-down rather than click, so dragging a selection out of
 * the panel does not close it.
 */

type DismissablePopoverOptions = {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
};

export function useDismissablePopover({
  open,
  onClose,
  containerRef,
  triggerRef,
}: DismissablePopoverOptions) {
  // Held in a ref so an inline `() => setOpen(false)` does not resubscribe both
  // document listeners on every render the popover is open.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onCloseRef.current();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onCloseRef.current();
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, containerRef, triggerRef]);
}
