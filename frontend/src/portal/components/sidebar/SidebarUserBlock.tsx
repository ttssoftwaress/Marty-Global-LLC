/*
 * Sidebar user block — avatar + name + role, used by the desktop sidebar and
 * the mobile drawer. The tablet rail has no user block.
 *
 * It is the sidebar's profile control: pressing it opens the same account menu
 * the top bar's avatar opens, so the two never disagree about what clicking your
 * own face does. `onOpenAccountMenu` is what makes it interactive — without it
 * the block stays plain content rather than an enabled button that opens
 * nothing.
 *
 * The avatar falls back to the user's initials on a brand chip until they upload
 * a photo; `avatarUrl` is a short-TTL presigned URL off the profile record.
 */

export type SidebarUser = {
  name: string;
  role: string;
  /* Shown in the account menu's header; absent until the profile record lands. */
  email?: string;
  avatarUrl?: string;
};

export function portalUserInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function UserIdentity({ user }: { user: SidebarUser }) {
  return (
    <>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-semibold text-white"
        >
          {portalUserInitials(user.name)}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <p className="truncate text-body font-semibold text-white">{user.name}</p>
        <p className="truncate text-small text-white/70">{user.role}</p>
      </div>
    </>
  );
}

type SidebarUserBlockProps = {
  user: SidebarUser;
  onOpenAccountMenu?: () => void;
  /** Drives the trigger's `aria-expanded` while the menu is open. */
  accountMenuOpen?: boolean;
};

export function SidebarUserBlock({
  user,
  onOpenAccountMenu,
  accountMenuOpen = false,
}: SidebarUserBlockProps) {
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
