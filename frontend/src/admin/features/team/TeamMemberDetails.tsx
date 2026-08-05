import {
  DetailField,
  DetailGrid,
  DetailPanel,
  DetailSection,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { AdminTeamMemberRow } from '../../types/team';
import { useAdminTeamMember } from './queries';

/*
 * The expanded panel under a team row — what this member can actually reach.
 *
 * Access is the whole reason anyone opens a staff record, and it is exactly
 * what a row of name/role/status cannot show: two people on the same role can
 * hold different areas, because a per-member switch OVERRIDES the role rather
 * than copying it. So the panel lists the granted areas and marks every one
 * that disagrees with the role — a denied area and an area the role never
 * granted look identical without it.
 *
 * The grid is fetched here rather than carried by the list. It is a map of
 * every permission area per member, which is the largest thing on the record
 * and is read on one row at a time.
 */

export function TeamMemberDetails({ member }: { member: AdminTeamMemberRow }) {
  const detail = useAdminTeamMember(member.id);
  const data = detail.data;

  const overridden = new Set(data?.overriddenPermissions ?? []);
  const areas = (data?.permissionAreas ?? []).filter(
    (area) => data?.permissions[area.key],
  );

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this member’s access."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Email">
          <a
            href={`mailto:${member.email}`}
            className="truncate text-primary hover:underline"
          >
            {member.email}
          </a>
        </DetailField>
        <DetailField label="Role">{member.roleLabel}</DetailField>
        <DetailField label="Status">{data?.statusDescription}</DetailField>
        <DetailField label="Joined">
          {member.joinedAt ? formatOrderDate(member.joinedAt) : null}
        </DetailField>
      </DetailGrid>

      <DetailSection title="Access">
        {data?.roleGrantsFullAccess ? (
          <p className="text-body text-text">
            This role carries the admin authorization role, so this member
            reaches every section regardless of the switches below.
          </p>
        ) : null}

        {areas.length === 0 ? (
          <p className="text-body text-gray-500">
            This member holds no areas yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {areas.map((area) => {
              const isOverride = overridden.has(area.key);

              return (
                <li
                  key={area.key}
                  title={
                    isOverride
                      ? 'Granted for this member specifically, not by their role'
                      : undefined
                  }
                  className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-caption font-medium ${
                    isOverride
                      ? 'bg-primary-light text-primary'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {area.label}
                  {isOverride ? (
                    <span className="text-caption font-semibold">·&nbsp;override</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>
    </DetailPanel>
  );
}
