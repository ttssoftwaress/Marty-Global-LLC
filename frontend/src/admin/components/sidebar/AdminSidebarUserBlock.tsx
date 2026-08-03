/*
 * Admin sidebar user block — avatar + name + role, used by the desktop sidebar
 * and the mobile drawer. The tablet rail shows the avatar alone.
 *
 * Both are the sidebar's profile control: pressing either opens the same account
 * menu the top bar's avatar opens, so the rail, the sidebar and the bar never
 * disagree about what clicking your own face does. `onOpenAccountMenu` is what
 * makes them interactive — without it they stay plain content rather than
 * enabled buttons that open nothing.
 *
 * The avatar falls back to the member's initials on a translucent white chip
 * until they upload a photo; `avatarUrl` is a short-TTL presigned URL off
 * `/admin/me`.
 */

export type AdminSidebarUser = {
  name: string;
  role: string;
  /* Shown in the account menu's header; absent until `/admin/me` lands. */
  email?: string;
  avatarUrl?: string;
};

export function adminUserInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function AdminSidebarAvatar({
  user,
  className,
}: {
  user: AdminSidebarUser;
  className?: string;
}) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className={`size-8 shrink-0 rounded-full object-cover ${className ?? ''}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-semibold text-white ${className ?? ''}`}
    >
      {adminUserInitials(user.name)}
    </span>
  );
}

type AdminAccountTriggerProps = {
  user: AdminSidebarUser;
  onOpenAccountMenu?: () => void;
  /** Drives the trigger's `aria-expanded` while the menu is open. */
  accountMenuOpen?: boolean;
};

/*
 * The rail's control: the avatar alone, since labels are invisible at that
 * width. It carries the account label as its accessible name and a native
 * tooltip, the same treatment every other rail control gets.
 */
export function AdminSidebarAvatarButton({
  user,
  onOpenAccountMenu,
  accountMenuOpen = false,
}: AdminAccountTriggerProps) {
  if (!onOpenAccountMenu) return <AdminSidebarAvatar user={user} />;

  return (
    <button
      type="button"
      onClick={onOpenAccountMenu}
      title="Account"
      aria-haspopup="dialog"
      aria-expanded={accountMenuOpen}
      aria-label={`Account menu — ${user.name}`}
      className="flex rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <AdminSidebarAvatar user={user} />
    </button>
  );
}

function UserIdentity({ user }: { user: AdminSidebarUser }) {
  return (
    <>
      <AdminSidebarAvatar user={user} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <p className="truncate text-body font-semibold text-white">{user.name}</p>
        <p className="truncate text-small text-white/70">{user.role}</p>
      </div>
    </>
  );
}

export function AdminSidebarUserBlock({
  user,
  onOpenAccountMenu,
  accountMenuOpen = false,
}: AdminAccountTriggerProps) {
  if (!onOpenAccountMenu) {
    return (
      <div className="flex w-full items-center gap-3">
        <UserIdentity user={user} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenAccountMenu}
      aria-haspopup="dialog"
      aria-expanded={accountMenuOpen}
      aria-label={`Account menu — ${user.name}`}
      /* Stretches to the column's width on its own (the footer is a flex
       * column), so the negative margin widens the hover surface symmetrically
       * past the sidebar padding instead of shifting the avatar off the
       * alignment it had as plain content. */
      className="-mx-2 flex items-center gap-3 rounded-input px-2 py-2 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <UserIdentity user={user} />
    </button>
  );
}
