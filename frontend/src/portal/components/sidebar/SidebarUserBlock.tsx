/*
 * Sidebar user block — avatar + name + role, used by the desktop sidebar and
 * the mobile drawer. The tablet rail has no user block.
 *
 * No photo ships with the app, so the avatar falls back to the user's initials
 * on a translucent white chip; pass `avatarUrl` once profile images exist.
 */

export type SidebarUser = {
  name: string;
  role: string;
  avatarUrl?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function SidebarUserBlock({ user }: { user: SidebarUser }) {
  return (
    <div className="flex w-full items-center gap-3">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-caption font-semibold text-white"
        >
          {initials(user.name)}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-body font-semibold text-white">{user.name}</p>
        <p className="truncate text-small text-white/70">{user.role}</p>
      </div>
    </div>
  );
}
