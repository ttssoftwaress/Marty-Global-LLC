import { formatOrderDate } from '../../lib/format';
import type { AdminTeamMemberRow } from '../../types/team';
import { TeamMemberAvatar } from './TeamMemberAvatar';
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
 * As in the table, the secondary action follows the member's state: resend for
 * an invite that has not been accepted, reactivate for a deactivated account,
 * deactivate otherwise. A member with no join date prints an em dash.
 */

type TeamCardListProps = {
  members: AdminTeamMemberRow[];
  onEdit: (member: AdminTeamMemberRow) => void;
  onToggleActive: (member: AdminTeamMemberRow) => void;
  onResendInvite: (member: AdminTeamMemberRow) => void;
};

export function TeamCardList({
  members,
  onEdit,
  onToggleActive,
  onResendInvite,
}: TeamCardListProps) {
  return (
    <ul className="flex w-full flex-col gap-4 md:hidden">
      {members.map((member) => {
        const isInvited = member.status === 'invited';
        const isDeactivated = member.status === 'deactivated';

        const secondaryLabel = isInvited
          ? 'Resend invite'
          : isDeactivated
            ? 'Reactivate'
            : 'Deactivate';

        const onSecondary = () =>
          isInvited ? onResendInvite(member) : onToggleActive(member);

        return (
          <li
            key={member.id}
            className="flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
          >
            <div className="flex items-center gap-3">
              <TeamMemberAvatar
                id={member.id}
                initials={member.initials}
                className="size-10 text-[14px] leading-5"
              />

              <span className="min-w-0 flex-1 truncate text-body font-semibold text-text">
                {member.name}
              </span>

              <TeamStatusChip
                status={member.status}
                label={member.statusLabel}
              />
            </div>

            <a
              href={`mailto:${member.email}`}
              className="truncate text-small text-gray-500 hover:text-primary hover:underline"
            >
              {member.email}
            </a>

            <p className="text-small text-gray-400">
              {member.roleLabel}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              Joined {member.joinedAt ? formatOrderDate(member.joinedAt) : '—'}
            </p>

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
                onClick={onSecondary}
                className="shrink-0 whitespace-nowrap px-1 text-body text-gray-500 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {secondaryLabel}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
