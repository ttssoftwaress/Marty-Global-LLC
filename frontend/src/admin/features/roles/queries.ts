import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminStaffRole,
  AdminStaffRolesView,
  StaffRoleCreatePayload,
  StaffRoleWritePayload,
} from '../../types/roles';

/*
 * Admin job-role data layer.
 *
 * One query backs the screen — the roles, the permission areas the grid draws,
 * and the access-level options — so a role always has a row for every key it
 * grants.
 *
 * Every mutation invalidates the *team* queries as well as this one, and that is
 * not defensive caching: editing a role changes what every member holding it can
 * reach, so the member list's role labels, the summary's role options, and any
 * open member record are all stale the moment a role is written. The team
 * summary in particular carries each role's grant set, which the add-staff form
 * seeds its grid from.
 */

export const adminRolesKey = () => ['admin', 'roles'] as const;

// GET /v1/admin/roles
export function useAdminRoles() {
  return useQuery({
    queryKey: adminRolesKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminStaffRolesView>>('/admin/roles').then(
        (res) => res.data,
      ),
  });
}

// Everything a role write can invalidate. Kept in one place so no mutation
// below can forget half of it.
function useRoleWriteInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: adminRolesKey() });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });
    // The shell's own nav is built from the signed-in member's areas, and an
    // admin can edit the role they hold themselves.
    void queryClient.invalidateQueries({ queryKey: ['admin', 'me'] });
  };
}

// POST /v1/admin/roles — define a new job role.
export function useCreateStaffRole() {
  const invalidate = useRoleWriteInvalidation();

  return useMutation({
    mutationFn: (payload: StaffRoleCreatePayload) =>
      apiFetch<ApiSuccess<AdminStaffRole>>('/admin/roles', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((res) => res.data),
    onSuccess: invalidate,
  });
}

/*
 * PATCH /v1/admin/roles/:roleId — rename a role, change its access level, or
 * change what it grants.
 *
 * The backend recomputes every member holding the role in the same transaction,
 * so the response is what actually took effect rather than what the form sent.
 */
export function useUpdateStaffRole() {
  const invalidate = useRoleWriteInvalidation();

  return useMutation({
    mutationFn: ({
      roleId,
      payload,
    }: {
      roleId: string;
      payload: StaffRoleWritePayload;
    }) =>
      apiFetch<ApiSuccess<AdminStaffRole>>(
        `/admin/roles/${encodeURIComponent(roleId)}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ).then((res) => res.data),
    onSuccess: invalidate,
  });
}

/*
 * DELETE /v1/admin/roles/:roleId.
 *
 * Refused by the backend while anyone still holds the role, and for the built-in
 * roles — the screen hides the action in both cases, but the refusal is the
 * boundary and its message is what gets shown if it fires anyway.
 */
export function useDeleteStaffRole() {
  const invalidate = useRoleWriteInvalidation();

  return useMutation({
    mutationFn: (roleId: string) =>
      apiFetch<ApiSuccess<{ id: string }>>(
        `/admin/roles/${encodeURIComponent(roleId)}`,
        { method: 'DELETE' },
      ).then((res) => res.data),
    onSuccess: invalidate,
  });
}
