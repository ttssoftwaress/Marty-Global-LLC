import { ChevronDown } from 'lucide-react';

/*
 * Top bar user control — 32px avatar, optionally followed by a chevron. Shared
 * by all three top bars: desktop and tablet show the chevron (they open a user
 * menu), mobile shows the avatar alone.
 *
 * No profile photo ships with the app, so the avatar falls back to the user's
 * initials on a brand-tinted chip — the same fallback the sidebar user block
 * uses. Pass `avatarUrl` once profile images exist.
 */

export type TopBarUser = {
  name: string;
  avatarUrl?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function TopBarAvatar({ user }: { user: TopBarUser }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className="size-8 shrink-0 rounded-[16px] object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-[16px] bg-primary-light text-caption font-semibold text-primary"
    >
      {initials(user.name)}
    </span>
  );
}

type TopBarUserMenuProps = {
  user: TopBarUser;
  onOpenUserMenu?: () => void;
  chevronSize: 16 | 20;
};

export function TopBarUserMenu({
  user,
  onOpenUserMenu,
  chevronSize,
}: TopBarUserMenuProps) {
  return (
    <button
      type="button"
      onClick={onOpenUserMenu}
      aria-haspopup="menu"
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
