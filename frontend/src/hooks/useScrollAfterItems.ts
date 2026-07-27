import { useLayoutEffect, useRef, useState } from 'react';

/*
 * Caps a feed at `visibleCount` items and lets everything past that scroll,
 * so a long history stops stretching the page it sits on.
 *
 * The cap is measured off the items themselves rather than written as a fixed
 * pixel max-height: activity entries and messages wrap to wildly different
 * heights, so any hardcoded value either clips an entry mid-sentence or leaves
 * dead space under a run of short ones. What comes back is the exact bottom
 * edge of the last item that should stay in view.
 *
 * The element the returned ref goes on must be both the scroll container and
 * the direct parent of the items, and must be positioned (`relative`) so the
 * items' offsets are measured against it and not against some ancestor.
 */
export function useScrollAfterItems<T extends HTMLElement = HTMLDivElement>(
  itemCount: number,
  visibleCount: number,
) {
  const ref = useRef<T>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      const items = Array.from(node.children) as HTMLElement[];
      const last = items[visibleCount - 1];

      if (!last || items.length <= visibleCount) {
        setMaxHeight(undefined);
        return;
      }

      setMaxHeight(last.offsetTop + last.offsetHeight);
    };

    measure();

    // Width changes rewrap the items, which changes where the fold lands.
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [itemCount, visibleCount]);

  return { ref, maxHeight } as const;
}
