import { Fragment } from 'react';

import {
  DetailRow,
  ExpandChevronCell,
  detailPanelId,
  expandRowProps,
  expandedRowClass,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { RowCheckbox } from '../../components/RowCheckbox';
import type { RowSelection } from '../../hooks/useRowSelection';
import { formatOrderDate } from '../../lib/format';
import type { AdminTeamMemberRow } from '../../types/team';
import { TeamMemberAvatar } from './TeamMemberAvatar';
import { TeamMemberDetails } from './TeamMemberDetails';
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
 *
 * Clicking the row opens what the columns cannot show: the areas this member
 * actually holds, and which of them override their role. Two people on one role
 * can differ, so that grid is the record — and it is fetched on expand rather
 * than carried by every row. One row is open at a time, and the three action
 * buttons stop their own clicks.
 */

type TeamTableProps = {
  members: AdminTeamMemberRow[];
  onEdit: (member: AdminTeamMemberRow) => void;
  onToggleActive: (member: AdminTeamMemberRow) => void;
  onDelete: (member: AdminTeamMemberRow) => void;
  selection: RowSelection;
  // False unless the signed-in member is an administrator — deleting a staff
  // account takes admin, so anyone else gets no tick column at all rather than
  // a selection that can only ever be refused.
  selectable: boolean;
};

export function TeamTable({
  members,
  onEdit,
  onToggleActive,
  onDelete,
  selection,
  selectable,
}: TeamTableProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[46rem] table-fixed lg:min-w-[56.25rem] lg:table-auto">
        <thead>
          <tr className="h-12">
            {selectable ? (
              <th scope="col" className="w-[3rem] pl-5 pr-0 lg:pl-card">
                <RowCheckbox
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAllVisible}
                  label="Select all staff on this page"
                />
              </th>
            ) : null}

            <th
              scope="col"
              className={
                selectable
                  ? 'pl-3 pr-4 lg:w-[13.75rem]'
                  : 'pl-5 pr-4 lg:w-[13.75rem] lg:pl-card'
              }
            >
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
              className="w-[12.5rem] pr-4 text-right lg:w-[16.25rem]"
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
            <th scope="col" className="w-[4rem] pr-5 lg:pr-card">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {members.map((member) => {
            const isDeactivated = member.status === 'deactivated';
            const statusLabel = isDeactivated ? 'Reactivate' : 'Deactivate';

            const isExpanded = member.id === expandedId;
            const panelId = detailPanelId('team', member.id);

            return (
              <Fragment key={member.id}>
              <tr
                {...expandRowProps({
                  isExpanded,
                  panelId,
                  onToggle: () => toggle(member.id),
                  label: `${isExpanded ? 'Hide' : 'Show'} access for ${member.name}`,
                })}
                className={expandedRowClass(isExpanded)}
              >
                {selectable ? (
                  <td
                    className="h-table-row py-3 pl-5 pr-0 lg:pl-card"
                    onClick={stopRowToggle}
                  >
                    <RowCheckbox
                      checked={selection.isSelected(member.id)}
                      onChange={() => selection.toggle(member.id)}
                      label={`Select ${member.name}`}
                    />
                  </td>
                ) : null}

                <td
                  className={`h-table-row py-3 pr-4 ${
                    selectable ? 'pl-3' : 'pl-5 lg:pl-card'
                  }`}
                >
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
                    onClick={stopRowToggle}
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

                <td className="py-3 pl-2 pr-4" onClick={stopRowToggle}>
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

                <ExpandChevronCell
                  isExpanded={isExpanded}
                  className="pr-5 lg:pr-card"
                />
              </tr>

              {isExpanded ? (
                <DetailRow panelId={panelId} colSpan={selectable ? 8 : 7}>
                  <TeamMemberDetails member={member} />
                </DetailRow>
              ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
