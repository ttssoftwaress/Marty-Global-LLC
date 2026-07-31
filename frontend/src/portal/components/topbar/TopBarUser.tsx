import { ChevronDown } from 'lucide-react';

import { portalUserInitials, type SidebarUser } from '../sidebar';

/*
 * Top bar user control — 32px avatar, optionally followed by a chevron. Shared
 * by all three top bars: desktop and tablet show the chevron, mobile shows the
 * avatar alone. All three open the shell's account menu.
 *
 * The user shape is the sidebar's `SidebarUser` and the initials fallback is its
 * `portalUserInitials`, so the bar and the sidebar never disagree about who is
 * signed in. On the navy sidebar the fallback chip is accent-filled; here it sits
 * on a white bar, so it uses the brand-tinted chip instead.
 */

export type TopBarUser = SidebarUser;

export function TopBarAvatar({ user }: { user: TopBarUser }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className="size-8 shrink-0 rounded-[1rem] object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-[1rem] bg-primary-light text-caption font-semibold text-primary"
    >
      {portalUserInitials(user.name)}
    </span>
  );
}

type TopBarUserMenuProps = {
  user: TopBarUser;
  onOpenUserMenu: () => void;
  accountMenuOpen?: boolean;
  chevronSize: 16 | 20;
};

export function TopBarUserMenu({
  user,
  onOpenUserMenu,
  accountMenuOpen = false,
  chevronSize,
}: TopBarUserMenuProps) {
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
      className="flex shrink-0 items-center gap-2 rounded-pill transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <TopBarAvatar user={user} />
      <ChevronDown
        className={chevronSize === 20 ? 'size-5 text-gray-600' : 'size-4 text-gray-600'}
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </button>
  );
}
