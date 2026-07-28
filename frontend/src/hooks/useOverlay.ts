import { useEffect, useRef } from 'react';

/*
 * The one implementation of modal overlay behaviour. Every dialog, slide-over,
 * drawer, and bottom sheet in both portals calls this — the behaviour used to be
 * hand-written per component, which is how four of them ended up trapping Tab
 * with a selector that omitted `input`/`select`/`textarea`, five never restored
 * focus to whatever opened them, and one shipped `aria-modal="true"` with no
 * Escape handler at all.
 *
 * What it owns, for the overlay's whole open lifetime:
 *   - Escape closes.
 *   - Tab and Shift+Tab are trapped inside the panel. A modal's scrim blocks the
 *     mouse but not the keyboard, so without this Tab walks out into the page
 *     behind and strands the user somewhere they cannot see.
 *   - Focus moves into the panel on open, and back to the trigger on close, so
 *     dismissing never drops the keyboard at the top of the document.
 *   - Background scroll is locked.
 *
 * Non-modal popovers (filter dropdowns, menus) deliberately do NOT use this:
 * they close on blur/outside-click and must leave page scroll and Tab alone.
 */

/*
 * Everything focusable a panel can realistically contain. `:not([disabled])`
 * matters because a disabled control is not tabbable, so treating one as the
 * first or last stop would wrap Tab onto an element the browser then skips.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/*
 * Several overlays render two shells — a mobile sheet and a desktop panel — and
 * hide one with `md:hidden`. A `display: none` element still answers
 * `querySelectorAll`, so an unfiltered trap can pick a hidden button as its
 * first or last stop and the wrap silently fails. `offsetParent === null` is the
 * cheap, layout-accurate test for "not rendered"; `position: fixed` elements
 * report a null offsetParent while visible, so they are matched separately.
 */
function isVisible(element: HTMLElement) {
  return (
    element.offsetParent !== null ||
    element.getClientRects().length > 0
  );
}

function focusableWithin(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

type UseOverlayOptions = {
  /* Mount-time-only overlays (those returning `null` when closed) pass `true`. */
  open: boolean;
  onClose: () => void;
  /* The element carrying `role="dialog"`. */
  panelRef: React.RefObject<HTMLElement | null>;
  /*
   * Skip the Tab trap for overlays that are visually modal but intentionally
   * non-blocking. Escape, focus restore, and the scroll lock still apply.
   */
  trapFocus?: boolean;
  /*
   * Focus this instead of the panel's first focusable — used where the design
   * points at a specific field (a subject line, a search box) rather than the
   * close button that happens to come first in the DOM.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

export function useOverlay({
  open,
  onClose,
  panelRef,
  trapFocus = true,
  initialFocusRef,
}: UseOverlayOptions) {
  /*
   * `onClose` is usually a fresh closure on every render of the page holding the
   * form draft, so it cannot be an effect dependency: the effect would tear down
   * and re-run on every keystroke, yanking focus out of the field being typed in
   * and back onto the panel's first focusable. The ref keeps the latest handler
   * while the effect stays tied to `open` alone.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !trapFocus) return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = focusableWithin(panel);
      if (focusable.length === 0) {
        // Nothing to land on — keep focus on the panel rather than letting Tab
        // escape to the page behind the scrim.
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      /*
       * Focus sitting on the panel container itself (or having drifted outside
       * entirely) belongs to neither end, so the plain first/last comparison
       * would let Tab fall through to the page behind. Pull it back to whichever
       * end the direction implies.
       */
      if (active === panel || !panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    /*
     * Focus lands after paint: the panel is being mounted in this same commit,
     * and several shells animate in, so querying focusables synchronously can
     * run before the visible shell has laid out and pick the hidden one.
     */
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const target =
        (initialFocusRef?.current && isVisible(initialFocusRef.current)
          ? initialFocusRef.current
          : null) ?? focusableWithin(panel)[0] ?? panel;

      target.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      /*
       * Only restore if focus is still somewhere in the overlay. If the close
       * happened because the user clicked something else on the page — or the
       * app navigated — stealing focus back to the old trigger would be worse
       * than leaving it where the user put it.
       */
      const active = document.activeElement;
      if (
        previouslyFocused?.isConnected &&
        (active === null || active === document.body || panelRef.current?.contains(active))
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, panelRef, trapFocus, initialFocusRef]);
}
