import type { Role } from '@/constants/roles';

/*
 * Local mirror of the backend's `AdminMe`
 * (backend/src/modules/admin/me/me.service.ts) — the signed-in staff member as
 * the admin shell needs them.
 *
 * The session alone is not enough to build the sidebar: Better Auth stores the
 * coarse auth role (`staff` / `admin`) and nothing finer, while the thing that
 * actually decides which admin sections a member may open is the permission grid
 * on their StaffProfile. This is how that grid reaches the browser.
 *
 * `permissions` holds area *keys*, not a nav list — the backend owns who may see
 * what, this app owns what each section is called and where it routes. A key the
 * frontend doesn't recognise is simply an area with no nav item yet; an unknown
 * key never hides a section it doesn't name.
 *
 * `roleLabel` is the job role ("Mail Room Operator"), which is what the sidebar
 * prints — the auth role reads as a permission level, not a job title.
 */
export type AdminMe = {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleKey: string | null;
  roleLabel: string;
  permissions: string[];
  // The member's own profile picture as a short-TTL presigned URL, absent until
  // they upload one. The shell prints initials in its place.
  avatarUrl?: string;
};
