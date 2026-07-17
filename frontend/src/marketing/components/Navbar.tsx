import { useState } from 'react';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { MenuIcon } from './icons';

/*
 * Marketing navbar — shared chrome across every public marketing page. Three
 * breakpoints per Figma:
 *   - mobile (<768px): logo + hamburger, 72px tall
 *   - tablet (md, 768px): logo + condensed links + button, 88px tall
 *   - desktop (lg, 1024px): logo + links + button, 88px tall
 * Links and the CTA are hidden below md; the hamburger is hidden from md up.
 */

type NavLink = {
  label: string;
  href: string;
};

const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

const ACTIVE_LINK = 'Home';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex h-[72px] w-full items-center justify-between border-b border-gray-200 bg-white px-5 md:h-[88px] md:px-10 lg:px-20">
      <a href="/" className="shrink-0" aria-label="Marty Global LLC — Home">
        <img
          src={logoColor}
          alt="Marty Global LLC"
          className="h-10 w-[120px] object-contain md:h-[50px] md:w-[140px]"
        />
      </a>

      <nav className="hidden items-center md:flex md:gap-5 lg:gap-8">
        {NAV_LINKS.map((link) => (
          <NavItem key={link.label} link={link} active={link.label === ACTIVE_LINK} />
        ))}
      </nav>

      <a
        href="/get-started"
        className="btn btn-primary hidden h-auto shrink-0 rounded-lg px-5 py-2.5 text-body md:inline-flex lg:rounded-input lg:px-6 lg:py-3 lg:text-button"
      >
        Get Started
      </a>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 md:hidden"
      >
        <MenuIcon className="size-5 text-text" />
      </button>
    </header>
  );
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  if (active) {
    return (
      <div className="flex flex-col items-center gap-1">
        <a
          href={link.href}
          className="whitespace-nowrap text-[13px] font-semibold text-primary lg:text-[14px] lg:font-medium"
        >
          {link.label}
        </a>
        <span className="h-0.5 w-3 rounded-[1px] bg-accent lg:w-4" />
      </div>
    );
  }

  return (
    <a
      href={link.href}
      className="whitespace-nowrap text-[13px] font-medium text-gray-700 lg:text-[14px] lg:font-normal"
    >
      {link.label}
    </a>
  );
}
