import type { MouseEvent } from 'react';
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
 */

export function useOpenOrderRow() {
  const navigate = useNavigate();

  return (to: string) => {
    if (window.getSelection()?.toString()) return;
    navigate(to);
  };
}

export const stopRowClick = (event: MouseEvent) => event.stopPropagation();
