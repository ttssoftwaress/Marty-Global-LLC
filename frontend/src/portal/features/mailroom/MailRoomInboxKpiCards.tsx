import { Archive, Clock, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { MailRoomInboxStats } from '../../types/mailroom';

/*
 * A room inbox's three headline figures. One tree serves every viewport: mobile
 * lays New mail and Pending requests side by side with Total items full-width
 * beneath (a 2-col grid where the last card spans both), tablet and desktop line
 * all three up. Padding and type scale up with the breakpoint.
 *
 * Each card carries its lucide icon top-right; New mail also carries a red dot
 * while anything is unread — the same attention signal the rooms overview uses.
 * (The mobile Figma swapped the icon for a colored dot; unified here to the
 * desktop/tablet icon+dot treatment so a card doesn't restyle across
 * breakpoints — see summary, matching MailRoomKpiCards.)
 */

type Kpi = {
  label: string;
  value: number;
  icon: LucideIcon;
  attention?: boolean;
  spanFull?: boolean;
};

export function MailRoomInboxKpiCards({ stats }: { stats: MailRoomInboxStats }) {
  const cards: Kpi[] = [
    { label: 'New mail', value: stats.newMail, icon: Mail, attention: stats.newMail > 0 },
    { label: 'Pending requests', value: stats.pendingRequests, icon: Clock },
    { label: 'Total items', value: stats.totalItems, icon: Archive, spanFull: true },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:gap-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-3 lg:p-card ${
            card.spanFull ? 'col-span-2 md:col-span-1' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[12px] font-medium tracking-[0.2px] text-gray-500 md:uppercase md:tracking-[0.4px]">
              {card.label}
            </p>
            <card.icon
              className="size-4 shrink-0 text-gray-400 lg:size-5"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </div>
          <p className="flex items-center gap-2 text-h4 font-semibold text-text md:text-[28px] md:leading-[36px] lg:text-h3">
            {card.value}
            {card.attention ? (
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-error lg:size-2"
              />
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}
