import { Link } from 'react-router-dom';

import { formatCount } from '../../lib/format';
import type {
  AttentionEmphasis,
  AttentionItem,
} from '../../types/dashboard';

/*
 * Needs attention — the queue of work waiting on the team, each row a title, a
 * one-line detail, and the action that clears it.
 *
 * The action's weight comes from the row's `emphasis`, which the backend sets:
 * outline for routine work, solid navy once it is overdue, solid accent when a
 * customer is blocked. The mobile link shows all three weights in one list, so
 * the variants are data-driven rather than positional — the same row keeps its
 * weight at every width instead of changing meaning across breakpoints.
 *
 * Mobile puts the section title above the card and drops the count badge into
 * that heading row, matching its link; from `md` the header (title + badge)
 * moves inside the card.
 */

const ACTION_STYLE: Record<AttentionEmphasis, string> = {
  default:
    'border border-primary bg-white text-primary hover:bg-primary-light',
  urgent: 'border border-primary bg-primary text-white hover:bg-primary-hover',
  critical: 'border border-accent bg-accent text-white hover:bg-accent-hover',
};

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <li className="flex items-start gap-3 border-b border-gray-200 py-4 last:border-b-0 md:items-center md:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[14px] font-semibold leading-5 text-text">
          {item.title}
        </p>
        <p className="text-[12px] leading-4 text-gray-500 md:text-[13px] lg:text-[12px]">
          {item.detail}
        </p>
      </div>

      <Link
        to={item.to}
        className={`flex shrink-0 items-center justify-center rounded-control px-3.5 py-2 text-[12px] font-semibold leading-5 transition-colors md:px-4 md:text-[14px] ${ACTION_STYLE[item.emphasis]}`}
      >
        {item.actionLabel}
      </Link>
    </li>
  );
}

type NeedsAttentionProps = {
  total: number;
  items: AttentionItem[];
};

export function NeedsAttention({ total, items }: NeedsAttentionProps) {
  const badge =
    total > 0 ? (
      <span className="flex shrink-0 items-center rounded-pill bg-[var(--color-status-missing-bg)] px-2 py-0.5 text-[12px] font-semibold leading-4 text-error">
        {formatCount(total)}
      </span>
    ) : null;

  return (
    <section className="flex w-full flex-col gap-2.5 md:gap-0 lg:w-[348px] lg:shrink-0">
      <div className="flex items-center gap-3 md:hidden">
        <h2 className="text-[14px] font-semibold leading-5 text-gray-700">
          Needs attention
        </h2>
        {badge}
      </div>

      <div className="flex w-full flex-col gap-0 rounded-card border border-gray-200 bg-white px-4 pb-1 shadow-sm-elevation md:gap-4 md:p-card">
        <div className="hidden items-center gap-3 md:flex">
          <h2 className="text-[18px] font-semibold leading-6 text-text">
            Needs attention
          </h2>
          {badge}
        </div>

        {items.length === 0 ? (
          <p className="py-4 text-[14px] leading-5 text-gray-500 md:py-0">
            Nothing needs attention — the queue is clear.
          </p>
        ) : (
          <ul className="flex w-full flex-col">
            {items.map((item) => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
