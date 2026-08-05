import { useCallback, useEffect, useMemo, useState } from 'react';

/*
 * Which rows an admin has ticked, for the tables that offer a bulk delete.
 *
 * Written once because every list needs the same four answers — is this row
 * selected, is the header box on, is it indeterminate, and what is selected now
 * — and the two easy things to get wrong are both about the rows LEAVING:
 *
 *   1. A selection must not survive a filter change. Ticking three orders on the
 *      "Submitted" tab and switching to "Paid" would otherwise leave a delete
 *      button armed with rows nobody can see. `resetKey` clears it.
 *
 *   2. A selection must not survive its rows. After a delete, a page refetch, or
 *      a "load more" that re-windows the list, an id that is no longer on screen
 *      has to drop out — otherwise the count in the toolbar disagrees with the
 *      ticks, and the next click deletes something the admin is not looking at.
 *      `selected` is therefore always intersected with the ids currently
 *      rendered, and is never simply the raw set.
 *
 * The raw set is still what is stored, so a row that scrolls out of a windowed
 * page and back in keeps its tick. `selected` is the derived, honest view of it.
 *
 * Header-box semantics are the conventional ones: it reflects and toggles the
 * rows CURRENTLY VISIBLE, never the whole result set. Selecting a filtered
 * thousand rows from a checkbox that says "25" is exactly the surprise a bulk
 * delete must not have.
 */

export type RowSelection = {
  // Ids that are both ticked and on screen — the set every caller should act on.
  selected: string[];
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  // The header box: on when every visible row is ticked, mixed when some are.
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  toggleAllVisible: () => void;
  clear: () => void;
};

export function useRowSelection(
  // The ids currently rendered, in order.
  visibleIds: string[],
  // Anything that invalidates the selection — the filter string, the tab, the
  // search term. Changing it clears the ticks.
  resetKey?: string,
): RowSelection {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setTicked(new Set());
  }, [resetKey]);

  const visible = useMemo(() => new Set(visibleIds), [visibleIds]);

  // Rule 2: only ever what is ticked AND on screen.
  const selected = useMemo(
    () => visibleIds.filter((id) => ticked.has(id)),
    [visibleIds, ticked],
  );

  const toggle = useCallback((id: string) => {
    setTicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const allVisibleSelected = visibleIds.length > 0 && selected.length === visibleIds.length;
  const someVisibleSelected = selected.length > 0 && !allVisibleSelected;

  const toggleAllVisible = useCallback(() => {
    setTicked((current) => {
      const next = new Set(current);
      const everyVisibleTicked =
        visibleIds.length > 0 && visibleIds.every((id) => next.has(id));

      for (const id of visibleIds) {
        if (everyVisibleTicked) next.delete(id);
        else next.add(id);
      }

      return next;
    });
  }, [visibleIds]);

  /*
   * Drops the ticks that are off screen too, not only the visible ones. `clear`
   * is called after a delete completes, and the rows it removed are exactly the
   * ones that must not be left ticked in the stored set.
   */
  const clear = useCallback(() => setTicked(new Set()), []);

  const isSelected = useCallback(
    (id: string) => ticked.has(id) && visible.has(id),
    [ticked, visible],
  );

  return {
    selected,
    count: selected.length,
    isSelected,
    toggle,
    allVisibleSelected,
    someVisibleSelected,
    toggleAllVisible,
    clear,
  };
}
