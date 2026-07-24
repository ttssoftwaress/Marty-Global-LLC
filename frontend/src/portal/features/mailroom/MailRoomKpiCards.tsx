import type { ReactNode } from 'react';

import type { MailRoomStats } from '../../types/mailroom';

/*
 * The three headline figures. One tree serves every viewport: mobile lays the
 * first two side by side with pending requests full-width beneath (a 2-col grid
 * where the last card spans both), tablet and desktop line all three up in a
 * row. Padding and type scale up with the breakpoint, matching the three links.
 *
 * The Unread mail figure carries a red dot while anything is unread — the same
 * attention signal the dashboard's mail card uses. (The mobile Figma instead
 * tinted the Unread/Pending numbers; unified here to the desktop/tablet
 * treatment so a figure doesn't change color across breakpoints — see summary.)
 */

type KpiCard = {
  label: string;
  value: ReactNode;
  spanFull?: boolean;
};

export function MailRoomKpiCards({ stats }: { stats: MailRoomStats }) {
  const cards: KpiCard[] = [
    { label: 'Total rooms', value: stats.totalRooms },
    {
      label: 'Unread mail',
      value: (
        <span className="flex items-center gap-2">
          {stats.unreadMail}
          {stats.unreadMail > 0 ? (
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-error lg:size-2"
            />
          ) : null}
        </span>
      ),
    },
    { label: 'Pending requests', value: stats.pendingRequests, spanFull: true },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation lg:p-card ${
            card.spanFull ? 'col-span-2 md:col-span-1' : ''
          }`}
        >
          <p className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500 md:text-gray-400 lg:text-small">
            {card.label}
          </p>
          <p className="text-h3 font-semibold text-text md:text-h4 lg:text-h3">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
