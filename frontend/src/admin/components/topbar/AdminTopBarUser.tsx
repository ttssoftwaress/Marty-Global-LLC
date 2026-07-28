import { ChevronDown } from 'lucide-react';

import { adminUserInitials, type AdminSidebarUser } from '../sidebar';

/*
 * Admin top bar user control — 32px avatar, optionally followed by a chevron.
 * Shared by all three bars: desktop and tablet show the chevron (they open an
 * account menu), mobile shows the avatar alone.
 *
 * The user shape is the sidebar's `AdminSidebarUser` and the initials fallback is
 * its `adminUserInitials`, so the bar and the rail never disagree about who is
 * signed in. On the navy sidebar the fallback chip is translucent white; here it
 * sits on a white bar, so it uses the brand-tinted chip instead — the same
 * treatment the portal top bar uses.
 */

export type AdminTopBarUser = AdminSidebarUser;

export function AdminTopBarAvatar({ user }: { user: AdminTopBarUser }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className="size-8 shrink-0 rounded-pill object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-primary-light text-caption font-semibold text-primary"
    >
      {adminUserInitials(user.name)}
    </span>
  );
}

type AdminTopBarUserMenuProps = {
  user: AdminTopBarUser;
  onOpenUserMenu?: () => void;
  /** Desktop draws a 16px chevron with an 8px gap; tablet 14px with 6px. */
  compact?: boolean;
};

export function AdminTopBarUserMenu({
  user,
  onOpenUserMenu,
  compact = false,
}: AdminTopBarUserMenuProps) {
  const chevron = (
    <ChevronDown
      className={compact ? 'size-[0.875rem] text-gray-600' : 'size-4 text-gray-600'}
      strokeWidth={1.75}
      aria-hidden="true"
    />
  );

  // No menu wired up yet — render the identity as plain content rather than an
  // enabled `aria-haspopup="menu"` button that opens nothing.
  if (!onOpenUserMenu) {
    return (
      <div
        className={`flex shrink-0 items-center ${compact ? 'gap-1.5' : 'gap-2'}`}
      >
        <AdminTopBarAvatar user={user} />
        <span className="sr-only">{user.name}</span>
        {chevron}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenUserMenu}
      aria-haspopup="menu"
      aria-label={`Account menu — ${user.name}`}
      className={`flex shrink-0 items-center rounded-pill transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        compact ? 'gap-1.5' : 'gap-2'
      }`}
    >
      <AdminTopBarAvatar user={user} />
      {chevron}
    </button>
  );
}
