import { isRole, Role, STAFF_ROLES } from '@/constants/roles';

// Where each role lands after authenticating. Staff and admin work the business,
// so they belong in the admin portal; customers land on their own dashboard.
// This is convenience routing — the backend guards are the real boundary
// (AGENTS.md "Auth").
export const PORTAL_ROUTE = '/app';
export const ADMIN_ROUTE = '/admin';

function isStaff(role: unknown): boolean {
  return isRole(role) && (STAFF_ROLES as readonly Role[]).includes(role);
}

// The default landing screen for a session's role. Anything unrecognised falls
// back to the customer portal — the narrower of the two areas.
export function landingRouteFor(role: unknown): string {
  return isStaff(role) ? ADMIN_ROUTE : PORTAL_ROUTE;
}

/*
 * The path to send a visitor to after logging in. RequireAuth / RequireRole stash
 * the path that was asked for before the redirect here, so logging in returns
 * them there instead of always to their dashboard.
 *
 * Only paths inside the role's own area are honoured: an attacker-supplied
 * absolute URL must never become a redirect target, and returning someone to
 * the other portal would just bounce off that area's guard on arrival.
 */
export function returnPathFor(role: unknown, from: unknown): string {
  const landing = landingRouteFor(role);

  if (typeof from !== 'string' || from.startsWith('//')) return landing;

  const isInArea = from === landing || from.startsWith(`${landing}/`);

  return isInArea ? from : landing;
}
