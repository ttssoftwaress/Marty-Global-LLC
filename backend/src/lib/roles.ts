// The three roles from AGENTS.md "Auth". Better Auth's admin plugin stores the
// role as a free-form string on the user row, so this is the backend's source of
// truth for what a valid role is — the frontend mirrors it in src/constants.
export const Role = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
  ADMIN: 'admin',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

const ROLES = Object.values(Role) as readonly string[];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value);
}

// Anything that can act on behalf of the business rather than a single customer.
export const STAFF_ROLES = [Role.STAFF, Role.ADMIN] as const;
