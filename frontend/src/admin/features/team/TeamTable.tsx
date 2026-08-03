import { formatOrderDate } from '../../lib/format';
import type { AdminTeamMemberRow } from '../../types/team';
import { TeamMemberAvatar } from './TeamMemberAvatar';
import { TeamStatusChip } from './TeamStatusChip';

/*
 * The team table — the desktop and tablet presentation (mobile renders cards
 * instead; see TeamCardList).
 *
 * One real `<table>` so the columns align, the header is announced, and the
 * values line up under their headings.
 *
 * The two links differ in how much they fit, which the same markup covers:
 *   - desktop (lg): six columns — name, email, role, status, date joined, and
 *     the actions, where Edit is an outlined button beside a plain secondary
 *     action.
 *   - tablet (md):  four — the email folds under the member's name, the date
 *     joined column drops out, and both actions become plain text links.
 *     `table-fixed` holds the allocation so a long name truncates instead of
 *     pushing the actions off the edge; desktop switches to `table-auto` and
 *     sizes to content.
 *
 * The status action follows the member's state: a member who is already
 * deactivated is reactivated rather than deactivated again, a state the links
 * show a filter tab for but never draw a row of (Design.md).
 *
 * The links draw two actions per row. A third, Delete, is added — it is the
 * screen's only way to remove a staff account, and it is drawn in the error
 * colour so it does not read as a peer of Edit. Logged as a deviation.
 *
 * A member with no join date prints an em dash, matching the desktop link.
 */

type TeamTableProps = {
  members: AdminTeamMemberRow[];
  onEdit: (member: AdminTeamMemberRow) => void;
  onToggleActive: (member: AdminTeamMemberRow) => void;
  onDelete: (member: AdminTeamMemberRow) => void;
};

export function TeamTable({
  members,
  onEdit,
  onToggleActive,
  onDelete,
}: TeamTableProps) {
  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[46rem] table-fixed lg:min-w-[56.25rem] lg:table-auto">
        <thead>
          <tr className="h-12">
            <th scope="col" className="pl-5 pr-4 lg:w-[13.75rem] lg:pl-card">
              Name
            </th>
            <th scope="col" className="hidden w-[15rem] pr-4 lg:table-cell">
              Email
            </th>
            <th scope="col" className="w-[11.25rem] pr-4">
              Role
            </th>
            <th scope="col" className="w-[8.75rem] pr-4">
              Status
            </th>
            <th scope="col" className="hidden w-[8.75rem] pr-4 lg:table-cell">
              Date joined
            </th>
            <th
              scope="col"
              className="w-[12.5rem] pr-5 text-right lg:w-[16.25rem] lg:pr-card"
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {members.map((member) => {
            const isDeactivated = member.status === 'deactivated';
            const statusLabel = isDeactivated ? 'Reactivate' : 'Deactivate';

            return (
              <tr
                key={member.id}
                className="transition-colors hover:bg-gray-50"
              >
                <td className="h-table-row py-3 pl-5 pr-4 lg:pl-card">
                  <div className="flex min-w-0 items-center gap-3">
                    <TeamMemberAvatar
                      id={member.id}
                      initials={member.initials}
                      className="size-8"
                    />

                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className="truncate font-semibold"
                        title={member.name}
                      >
                        {member.name}
                      </span>
                      {/* Tablet folds the email under the name; `lg` has its own
                          column. */}
                      <span className="truncate text-small text-gray-500 lg:hidden">
                        {member.email}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="hidden py-3 pr-4 lg:table-cell">
                  <a
                    href={`mailto:${member.email}`}
                    title={member.email}
                    className="block truncate text-gray-500 hover:text-primary hover:underline"
                  >
                    {member.email}
                  </a>
                </td>

                <td className="py-3 pr-4">
                  <span className="block truncate" title={member.roleLabel}>
                    {member.roleLabel}
                  </span>
                </td>

                <td className="py-3 pr-4">
                  <TeamStatusChip
                    status={member.status}
                    label={member.statusLabel}
                  />
                </td>

                <td className="hidden py-3 pr-4 lg:table-cell">
                  <span className="whitespace-nowrap text-text-secondary">
                    {member.joinedAt ? formatOrderDate(member.joinedAt) : '—'}
                  </span>
                </td>

                <td className="py-3 pl-2 pr-5 lg:pr-card">
                  <div className="flex items-center justify-end gap-2 lg:gap-2">
                    {/* Tablet draws both actions as plain text; desktop gives
                        Edit an outlined button. */}
                    <button
                      type="button"
                      onClick={() => onEdit(member)}
                      className="whitespace-nowrap rounded-[0.5rem] text-[0.875rem] font-medium leading-5 text-gray-500 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:h-8 lg:border lg:border-gray-300 lg:bg-white lg:px-3 lg:text-[0.75rem] lg:font-semibold lg:leading-4 lg:text-text lg:hover:bg-gray-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleActive(member)}
                      className="whitespace-nowrap rounded-[0.5rem] px-0 text-[0.875rem] font-medium leading-5 text-gray-500 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:h-8 lg:px-3 lg:text-[0.75rem] lg:leading-4"
                    >
                      {statusLabel}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(member)}
                      className="whitespace-nowrap rounded-[0.5rem] px-0 text-[0.875rem] font-medium leading-5 text-error transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error lg:h-8 lg:px-3 lg:text-[0.75rem] lg:leading-4"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
