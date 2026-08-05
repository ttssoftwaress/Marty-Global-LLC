import {
  ExpandChevron,
  detailPanelId,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { AdminTeamMemberRow } from '../../types/team';
import { TeamMemberAvatar } from './TeamMemberAvatar';
import { TeamMemberDetails } from './TeamMemberDetails';
import { TeamStatusChip } from './TeamStatusChip';

/*
 * The mobile presentation of the list — one card per member, replacing the table
 * below `md`. Each card follows its link: the initials avatar with the name and
 * the status chip on the top row, the email under it, then a meta line of role ·
 * join date, and an outlined "Edit" button beside the plain secondary action.
 *
 * The meta line's separator is decorative, so it is hidden from assistive tech
 * and the join date keeps a word with it — a screen reader reads "Super Admin,
 * joined Jan 15, 2025" rather than two bare values.
 *
 * As in the table, the status action follows the member's state: reactivate for
 * a deactivated account, deactivate otherwise. Delete is added beside it in the
 * error colour — the screen's only way to remove a staff account, and the same
 * deviation the table logs. A member with no join date prints an em dash.
 *
 * Tapping the card body opens the same access panel the table's rows open,
 * fetched when opened. One card is open at a time.
 */

type TeamCardListProps = {
  members: AdminTeamMemberRow[];
  onEdit: (member: AdminTeamMemberRow) => void;
  onToggleActive: (member: AdminTeamMemberRow) => void;
  onDelete: (member: AdminTeamMemberRow) => void;
};

export function TeamCardList({
  members,
  onEdit,
  onToggleActive,
  onDelete,
}: TeamCardListProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <ul className="flex w-full flex-col gap-4 md:hidden">
      {members.map((member) => {
        const isDeactivated = member.status === 'deactivated';
        const statusLabel = isDeactivated ? 'Reactivate' : 'Deactivate';
        const isExpanded = member.id === expandedId;
        const panelId = detailPanelId('team-card', member.id);

        return (
          <li
            key={member.id}
            className="flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
          >
            <button
              type="button"
              onClick={() => toggle(member.id)}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              className="flex flex-col gap-2 rounded-input text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex items-center gap-3">
                <TeamMemberAvatar
                  id={member.id}
                  initials={member.initials}
                  className="size-10 text-[0.875rem] leading-5"
                />

                <span className="min-w-0 flex-1 truncate text-body font-semibold text-text">
                  {member.name}
                </span>

                <TeamStatusChip
                  status={member.status}
                  label={member.statusLabel}
                />

                <ExpandChevron isExpanded={isExpanded} />
              </span>

              <span className="block truncate text-small text-gray-500">
                {member.email}
              </span>

              <span className="block text-small text-gray-400">
                {member.roleLabel}
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
                Joined {member.joinedAt ? formatOrderDate(member.joinedAt) : '—'}
              </span>
            </button>

            {isExpanded ? (
              <div id={panelId} onClick={stopRowToggle}>
                <TeamMemberDetails member={member} />
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onEdit(member)}
                className="flex h-10 flex-1 items-center justify-center rounded-control border border-primary bg-white text-body font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => onToggleActive(member)}
                className="shrink-0 whitespace-nowrap px-1 text-body text-gray-500 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {statusLabel}
              </button>

              <button
                type="button"
                onClick={() => onDelete(member)}
                className="shrink-0 whitespace-nowrap px-1 text-body text-error transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
