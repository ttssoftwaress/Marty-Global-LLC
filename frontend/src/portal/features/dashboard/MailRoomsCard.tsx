import type { MailRoomSummary } from '../../types/dashboard';
import { SummaryCard } from './SummaryCard';

/*
 * Virtual mail rooms — room count, unread items, and outstanding requests. The
 * unread row carries a red dot while anything is unread, matching the same
 * signal on the KPI card.
 */

export function MailRoomsCard({ mailRooms }: { mailRooms: MailRoomSummary }) {
  return (
    <SummaryCard
      title="Virtual mail rooms"
      linkLabel="Inboxes"
      to="/app/mailroom"
      entries={[
        {
          label: 'Total rooms',
          value: `${mailRooms.totalRooms} active`,
        },
        {
          label: 'Unread mail',
          value: (
            <span className="inline-flex items-center gap-1.5">
              {mailRooms.unreadMail} {mailRooms.unreadMail === 1 ? 'item' : 'items'}
              {mailRooms.unreadMail > 0 ? (
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-error"
                />
              ) : null}
            </span>
          ),
        },
        {
          label: 'Pending requests',
          value: String(mailRooms.pendingRequests),
        },
      ]}
    />
  );
}
