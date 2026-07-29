// Local mirror of backend/src/lib/roles.ts — the backend is the source of truth
// (AGENTS.md "Two Independent Apps"). Better Auth's admin plugin stores the role
// as a free-form string on the user row, so `isRole` narrows it before use.
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
