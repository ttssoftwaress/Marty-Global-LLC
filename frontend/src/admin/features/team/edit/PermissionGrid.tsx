import type { TeamPermissionArea } from '../../../types/team-member-edit';
import { TeamToggleSwitch } from './TeamToggleSwitch';

/*
 * The permission table — one row per area of the admin portal, each with up to
 * two switches. Shared by the edit screen's "Role & permissions" card and the
 * add-staff form, so the two cannot drift on what the columns mean or on how
 * the pair interacts.
 *
 * THE TWO COLUMNS
 *
 * "Specific data" grants the area and shows the member the records assigned to
 * them. "All data" widens that same area to the whole organisation. Granting
 * Quotes & payments as specific-data means the member sees the quotes raised
 * against their own orders and nothing else; turning All data on for that row is
 * what makes them see every quote in the business.
 *
 * The pairing comes from the API: an area carries a `scopeKey` when it can be
 * widened, and areas with no owner to narrow to (the service catalog, the staff
 * directory) carry none and render an em dash in the second cell. The UI never
 * derives the companion key by appending ".all" — which areas are scopeable is a
 * backend decision, the same rule the area list itself follows.
 *
 * All data depends on the area: turning "Specific data" off turns its "All data"
 * off with it, and the widen switch is disabled while the area is denied. A
 * member cannot be given the whole org's records in a section they may not open,
 * so the pair is never left in that state to submit. The backend drops the
 * orphan too — this is the courtesy, not the boundary.
 *
 * RESPONSIVE
 *
 * Two switches per row make the previous column-major tablet split untenable:
 * the halves could not sit under a header that still described them. So the
 * table runs one row per area at every width, with the switch columns holding
 * their place. Below `sm` the header is dropped and each switch takes an inline
 * caption instead, because two unlabelled switches side by side on a narrow row
 * are ambiguous in a way the wide header solves and a cramped one does not.
 */

type PermissionGridProps = {
  areas: TeamPermissionArea[];
  permissions: Record<string, boolean>;
  onPermissionChange: (key: string, next: boolean) => void;
};

export function PermissionGrid({
  areas,
  permissions,
  onPermissionChange,
}: PermissionGridProps) {
  /*
   * Denying the area denies its scope in the same change, so the pair can never
   * be submitted as "all data in a section you cannot open". Granting the area
   * back does not restore the scope — widening is a separate, deliberate act.
   */
  const handleAreaChange = (area: TeamPermissionArea, next: boolean) => {
    onPermissionChange(area.key, next);

    if (!next && area.scopeKey && permissions[area.scopeKey]) {
      onPermissionChange(area.scopeKey, false);
    }
  };

  return (
    <div className="w-full">
      <div className="hidden items-end gap-4 border-b border-gray-300 pb-2 sm:flex">
        <p className="min-w-0 flex-1 text-small font-medium text-gray-500">
          Permission
        </p>
        <p className="w-[104px] shrink-0 text-center text-small font-medium text-gray-500">
          Specific data
        </p>
        <p className="w-[104px] shrink-0 text-center text-small font-medium text-gray-500">
          All data
        </p>
      </div>

      {areas.map((area) => {
        const granted = permissions[area.key] === true;
        // A scope switch is only meaningful while the area itself is granted.
        const scopeDisabled = area.locked === true || !granted;

        return (
          <div
            key={area.key}
            className="flex flex-col gap-3 border-b border-gray-200 py-4 sm:flex-row sm:items-center sm:gap-4 sm:py-3"
          >
            <p className="min-w-0 flex-1 text-form-label text-gray-800">
              {area.label}
            </p>

            <div className="flex items-center gap-6 sm:contents">
              <div className="flex items-center gap-2 sm:w-[104px] sm:shrink-0 sm:justify-center">
                <span className="text-small text-gray-500 sm:hidden">Specific</span>
                <TeamToggleSwitch
                  checked={granted}
                  onChange={(next) => handleAreaChange(area, next)}
                  label={`${area.label} — specific data`}
                  disabled={area.locked}
                />
              </div>

              <div className="flex items-center gap-2 sm:w-[104px] sm:shrink-0 sm:justify-center">
                <span className="text-small text-gray-500 sm:hidden">All data</span>
                {area.scopeKey ? (
                  <TeamToggleSwitch
                    checked={permissions[area.scopeKey] === true}
                    onChange={(next) =>
                      onPermissionChange(area.scopeKey as string, next)
                    }
                    label={`${area.label} — all data`}
                    disabled={scopeDisabled}
                  />
                ) : (
                  /*
                   * An area with no `scopeKey` cannot be widened — there is no
                   * ownership to narrow it to in the first place — so the cell
                   * holds a dash rather than a switch that would imply a
                   * distinction the backend does not draw.
                   */
                  <span aria-hidden="true" className="text-body text-gray-300">
                    —
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
