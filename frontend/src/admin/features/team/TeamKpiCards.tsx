import { formatCount } from '../../lib/format';
import type { AdminTeamSummary } from '../../types/team';

/*
 * The three headline figures — total members, active members, pending invites.
 *
 * The desktop and tablet links put all three on one row; the mobile link splits
 * them, with the first two sharing a row and "Pending invites" spanning the
 * width beneath. One grid covers it: two columns on mobile with the third card
 * spanning both, three from `md` up.
 *
 * Every figure comes from the summary query — nothing here is a fixed number.
 */

type TeamKpiCardsProps = {
  summary: AdminTeamSummary;
};

const CARD =
  'flex flex-col gap-1 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-1.5 md:p-5 lg:gap-2 lg:p-card';

const LABEL =
  'text-caption font-medium uppercase tracking-[0.6px] text-gray-500';

const VALUE = 'text-[32px] font-semibold leading-10 text-text lg:text-[36px] lg:leading-[44px]';

export function TeamKpiCards({ summary }: TeamKpiCardsProps) {
  const cards = [
    { label: 'Total team members', value: summary.totalMembers },
    { label: 'Active members', value: summary.activeMembers },
    { label: 'Pending invites', value: summary.pendingInvites },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-6">
      {cards.map((card, index) => (
        <div
          key={card.label}
          // Mobile's third card spans the row; from `md` every card is one
          // column of three.
          className={`${CARD} ${index === 2 ? 'col-span-2 md:col-span-1' : ''}`}
        >
          <p className={LABEL}>{card.label}</p>
          <p className={VALUE}>{formatCount(card.value)}</p>
        </div>
      ))}
    </div>
  );
}
