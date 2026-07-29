import type { KeyboardEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

/*
 * Row navigation for the queue — shared by the table (md and up) and the mobile
 * cards, so a row behaves the same whichever of the two is drawn.
 *
 * The destination is always the row's own `to`, which the backend resolves. The
 * queue never builds an order's URL itself, here or anywhere else.
 *
 * A click anywhere on the row opens it, with two exceptions:
 *   - a click that ends a text selection is someone copying a reference or a
 *     customer name, not navigating
 *   - a click on one of the row's own controls — the select checkbox, the
 *     reference link, the action button — belongs to that control, which stops
 *     the event before it reaches the row
 *
 * The row is a keyboard target too, not just a pointer one: `useOrderRowProps`
 * gives it a tab stop and Enter/Space activation, so the enlarged target is not
 * mouse-only. The keydown only fires when the row itself is focused — a key
 * press inside a nested link belongs to that link and must not navigate twice.
 *
 * No `role` is set on the row. `role="button"`/`role="link"` may not contain
 * interactive descendants, and every row holds a link (and the queue's rows a
 * checkbox as well); on a `<tr>` it would also drop the row out of the table's
 * structure. The element keeps its native role and gains the behaviour.
 */

function useOpenOrderRow() {
  const navigate = useNavigate();

  return (to: string) => {
    if (window.getSelection()?.toString()) return;
    navigate(to);
  };
}

export const stopRowClick = (event: MouseEvent) => event.stopPropagation();

/*
 * The outline is inset — a row sits flush against its neighbours (table borders,
 * card gaps), so an outward offset would be clipped or overlap the row above.
 */
export const ROW_FOCUS_CLASS =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

export function useOrderRowProps() {
  const openOrderRow = useOpenOrderRow();

  return (to: string) => ({
    tabIndex: 0,
    onClick: () => openOrderRow(to),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openOrderRow(to);
    },
  });
}
