import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Pull-to-refresh for the portal and admin shells.
 *
 * The browser's own gesture cannot fire on these screens by construction: it is
 * offered only on the document scroller, and both shells pin the document
 * (styles/index.css) and scroll their own `<main>` instead so the sidebar and
 * top bar stay put. That is the right layout and the wrong gesture surface, so
 * the gesture is re-created on the element that actually scrolls.
 *
 * Listeners are bound natively rather than through React's `onTouch*` props
 * because React registers `touchmove` as passive at the root — `preventDefault()`
 * inside a React handler is a no-op there, and without it the scroller
 * rubber-bands on iOS while the indicator is being dragged.
 *
 * Distances here are px, not rem, and that is deliberate: a drag is a physical
 * distance under a thumb, and the compact-density scheme (80% root font-size on
 * exactly these surfaces) must not make the gesture shorter than it is on a
 * marketing page.
 */

const TRIGGER = 64; // resisted travel before a release refreshes
const MAX_PULL = 96; // ceiling, so the indicator cannot be dragged down the page
const REST = 52; // where the indicator parks while the refetch is in flight
const RESISTANCE = 0.45; // finger travel → indicator travel
const DIRECTION_LOCK = 4; // travel before the gesture's axis is decided
const MIN_SPIN = 450; // a warm cache still has to read as a refresh, not a flicker

type PullToRefreshOptions = {
  onRefresh: () => Promise<unknown> | unknown;
  disabled?: boolean;
};

type PullToRefreshState = {
  /** Callback ref for the scrolling element — the shells' `<main>`. */
  setScroller: (node: HTMLElement | null) => void;
  /** How far the indicator sits below its hidden rest position, in px. */
  offset: number;
  /** 0 → 1, how close the pull is to triggering. */
  progress: number;
  refreshing: boolean;
  /** True while a finger is driving the offset — the indicator must not lerp. */
  dragging: boolean;
};

export function usePullToRefresh({
  onRefresh,
  disabled = false,
}: PullToRefreshOptions): PullToRefreshState {
  /*
   * The scroller is held in state rather than a ref because both shells key
   * their `<main>` on the route section: the node is replaced on navigation, and
   * a ref would leave the listeners bound to a detached element.
   */
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const refreshingRef = useRef(false);
  const distanceRef = useRef(0);
  const trackingRef = useRef(false);
  const startY = useRef(0);
  const startX = useRef(0);
  const settleTimer = useRef<number | undefined>(undefined);

  const reset = useCallback(() => {
    trackingRef.current = false;
    distanceRef.current = 0;
    setDistance(0);
  }, []);

  const startRefresh = useCallback(() => {
    refreshingRef.current = true;
    setRefreshing(true);
    distanceRef.current = 0;
    setDistance(0);

    const startedAt = performance.now();
    void Promise.resolve(onRefreshRef.current())
      .catch(() => {
        // The refetch reports its own failure through the query's error state —
        // the indicator's only job is to stop spinning either way.
      })
      .finally(() => {
        const elapsed = performance.now() - startedAt;
        settleTimer.current = window.setTimeout(
          () => {
            refreshingRef.current = false;
            setRefreshing(false);
          },
          Math.max(0, MIN_SPIN - elapsed),
        );
      });
  }, []);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  useEffect(() => {
    if (!scroller || disabled) return;

    /*
     * A gesture that starts inside a list which has its own scrollbar (a chat
     * thread, an activity feed) belongs to that list, not to the page — arming
     * there would refresh the screen instead of scrolling the list back up.
     */
    const startsInsideScrolledChild = (target: EventTarget | null) => {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== scroller) {
        const { overflowY } = getComputedStyle(node);
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          node.scrollTop > 0
        ) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (refreshingRef.current || !touch || event.touches.length !== 1) return;
      if (scroller.scrollTop > 0) return;
      if (startsInsideScrolledChild(event.target)) return;

      startY.current = touch.clientY;
      startX.current = touch.clientX;
      trackingRef.current = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!trackingRef.current || refreshingRef.current) return;

      const touch = event.touches[0];
      if (!touch || event.touches.length !== 1) {
        reset();
        return;
      }

      const deltaY = touch.clientY - startY.current;
      const deltaX = touch.clientX - startX.current;

      // Too early to tell which way this gesture goes — claim nothing yet.
      if (
        Math.abs(deltaY) < DIRECTION_LOCK &&
        Math.abs(deltaX) < DIRECTION_LOCK
      ) {
        return;
      }

      // Upward, sideways, or the content has already scrolled: an ordinary
      // scroll or a horizontal swipe. Hand it back to the browser untouched.
      if (
        deltaY <= 0 ||
        Math.abs(deltaX) > Math.abs(deltaY) ||
        scroller.scrollTop > 0
      ) {
        reset();
        return;
      }

      if (event.cancelable) event.preventDefault();

      const pulled = Math.min(MAX_PULL, deltaY * RESISTANCE);
      distanceRef.current = pulled;
      setDistance(pulled);
    };

    const onTouchEnd = () => {
      if (!trackingRef.current || refreshingRef.current) return;

      const pulled = distanceRef.current;
      trackingRef.current = false;

      if (pulled < TRIGGER) {
        reset();
        return;
      }
      startRefresh();
    };

    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    scroller.addEventListener('touchend', onTouchEnd, { passive: true });
    scroller.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('touchend', onTouchEnd);
      scroller.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [scroller, disabled, reset, startRefresh]);

  return {
    setScroller,
    offset: refreshing ? REST : distance,
    progress: refreshing ? 1 : Math.min(1, distance / TRIGGER),
    refreshing,
    dragging: distance > 0,
  };
}
