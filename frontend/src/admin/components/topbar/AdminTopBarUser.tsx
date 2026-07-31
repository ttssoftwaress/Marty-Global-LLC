import { ChevronDown } from 'lucide-react';

import { adminUserInitials, type AdminSidebarUser } from '../sidebar';

/*
 * Admin top bar user control — 32px avatar, optionally followed by a chevron.
 * Shared by all three bars: desktop and tablet show the chevron, mobile shows the
 * avatar alone. All three open the shell's account menu.
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
  onOpenUserMenu: () => void;
  accountMenuOpen?: boolean;
  /** Desktop draws a 16px chevron with an 8px gap; tablet 14px with 6px. */
  compact?: boolean;
};

export function AdminTopBarUserMenu({
  user,
  onOpenUserMenu,
  accountMenuOpen = false,
  compact = false,
}: AdminTopBarUserMenuProps) {
  const chevron = (
    <ChevronDown
      className={compact ? 'size-[0.875rem] text-gray-600' : 'size-4 text-gray-600'}
      strokeWidth={1.75}
      aria-hidden="true"
    />
  );

  return (
    <button
      type="button"
      onClick={onOpenUserMenu}
      /* The panel it opens is `role="dialog"`, not a menu — the two roles carry
       * different keyboard expectations, so the trigger advertises the one that
       * actually appears. */
      aria-haspopup="dialog"
      aria-expanded={accountMenuOpen}
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
