import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { ChevronDownIcon, MenuIcon } from '../icons';

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

/*
 * The Services menu. Every service has a detail page, and four of them had no
 * route into the site except the footer — so the nav item that already exists
 * carries them.
 *
 * Desktop: a hover/click dropdown off the "Services" link, which still
 * navigates to `/services` on its own. Mobile: the same list, indented under
 * Services inside the sheet — no second layer of interaction on a menu that is
 * already a popover.
 */
const SERVICE_LINKS: NavLink[] = [
  { label: 'Company Formation', href: '/services/formation' },
  { label: 'Registered Agent', href: '/services/registered-agent' },
  { label: 'Virtual Mail Room', href: '/services/mailroom' },
  { label: 'Bank Account Opening', href: '/services/banking' },
  { label: 'E-Commerce Account Setup', href: '/services/ecommerce' },
  { label: 'Remote Desktop (RDP)', href: '/services/remote-desktop' },
  { label: 'Website Design & Development', href: '/services/website' },
];

// FAQ sits between "How It Works" and "About Us" — it answers the questions a
// visitor has right after reading the process, and before deciding to contact
// us. Six links is the most the tablet row holds at its condensed size, so the
// gap tightens there rather than the row wrapping.
const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'FAQ', href: '/faq' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

// The active link is the one whose href matches the current path. '/' only
// matches exactly (the home page); every other link matches its own subtree so
// nested routes keep the correct tab underlined.
function isActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  // Wraps the trigger and the panel, so a press on either is not an outside press.
  const headerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /*
   * The mobile sheet is a non-modal popover (Design.md): it dismisses on an
   * outside press and on Escape and leaves page scroll and Tab alone — no scrim,
   * no focus trap. Marketing keeps its own copy of the behaviour rather than
   * importing the admin hook; areas never import across the boundary.
   *
   * Scroll dismisses it too, which a popover anchored to a scrolled-away trigger
   * needs and the admin hook has no reason to do: this panel hangs off a static
   * header, so scrolling carries it off-screen while `menuOpen` stays true and
   * the hamburger keeps reporting `aria-expanded="true"` for a menu nobody can
   * see. Captured rather than bubbled — scroll events do not bubble, so a
   * listener on `document` only sees them on the way down.
   */
  useEffect(() => {
    if (!menuOpen) return;

    const close = () => setMenuOpen(false);

    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', close, { capture: true, passive: true });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', close, { capture: true });
    };
  }, [menuOpen]);

  return (
    <header
      ref={headerRef}
      className="relative flex h-[72px] w-full items-center justify-between border-b border-gray-200 bg-white px-5 md:h-[88px] md:px-10 lg:px-20"
    >
      <Link to="/" className="shrink-0" aria-label="Marty Global LLC — Home">
        <img
          src={logoColor}
          alt="Marty Global LLC"
          className="h-10 w-[120px] object-contain md:h-[50px] md:w-[140px]"
        />
      </Link>

      <nav className="hidden items-center md:flex md:gap-3.5 lg:gap-7">
        {NAV_LINKS.map((link) =>
          link.href === '/services' ? (
            <ServicesNavItem
              key={link.label}
              link={link}
              active={isActive(link.href, pathname)}
            />
          ) : (
            <NavItem
              key={link.label}
              link={link}
              active={isActive(link.href, pathname)}
            />
          ),
        )}
      </nav>

      <Link
        to="/get-started"
        className="btn btn-primary hidden h-auto shrink-0 rounded-lg px-5 py-2.5 text-body md:inline-flex lg:rounded-input lg:px-6 lg:py-3 lg:text-button"
      >
        Get Started
      </Link>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        aria-controls="mobile-nav"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 transition-colors hover:bg-gray-100 md:hidden"
      >
        <MenuIcon className="size-5 text-text" />
      </button>

      {menuOpen && (
        <nav
          id="mobile-nav"
          className="absolute inset-x-0 top-full z-50 flex animate-rise flex-col gap-1 border-b border-gray-200 bg-white px-5 py-4 shadow-lg motion-reduce:animate-none md:hidden"
        >
          {NAV_LINKS.map((link) => (
            <div key={link.label} className="flex flex-col">
              <Link
                to={link.href}
                onClick={() => setMenuOpen(false)}
                className={
                  isActive(link.href, pathname)
                    ? 'press-soft rounded-lg px-3 py-2.5 text-body font-semibold text-primary'
                    : 'press-soft rounded-lg px-3 py-2.5 text-body font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-primary'
                }
              >
                {link.label}
              </Link>

              {/* The service pages, indented under Services. Listed rather than
               * collapsed behind a second toggle — the sheet is already a
               * popover, and a menu that needs two taps to reach a page defeats
               * the point of putting them here. */}
              {link.href === '/services' && (
                <div className="flex flex-col border-l border-gray-200 pl-3 ml-3">
                  {SERVICE_LINKS.map((service) => (
                    <Link
                      key={service.href}
                      to={service.href}
                      onClick={() => setMenuOpen(false)}
                      className={
                        pathname === service.href
                          ? 'press-soft rounded-lg px-3 py-2 text-[13px] font-semibold text-primary'
                          : 'press-soft rounded-lg px-3 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary'
                      }
                    >
                      {service.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link
            to="/get-started"
            onClick={() => setMenuOpen(false)}
            className="btn btn-primary mt-2 h-auto rounded-lg px-5 py-2.5 text-body"
          >
            Get Started
          </Link>
        </nav>
      )}
    </header>
  );
}

/*
 * "Services" with its menu of service pages.
 *
 * The label is still a link — pressing it goes to `/services`, because that page
 * is the catalogue and always was. The chevron beside it is the disclosure, so
 * the menu never swallows the destination the way a trigger-only dropdown does.
 *
 * A non-modal popover (Design.md): it closes on Escape, on an outside press, and
 * on scroll, returns focus to its trigger, and leaves page scroll and Tab alone.
 * Marketing keeps its own copy of that behaviour rather than importing the
 * admin hook — areas never import across the boundary — and the mobile sheet
 * above already does the same thing.
 */
function ServicesNavItem({ link, active }: { link: NavLink; active: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', close, { capture: true, passive: true });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', close, { capture: true });
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex flex-col items-center">
      <div className="flex items-center gap-1">
        <Link
          to={link.href}
          className={
            active
              ? 'whitespace-nowrap text-[13px] font-semibold text-primary lg:text-[14px] lg:font-medium'
              : 'link-underline whitespace-nowrap text-[13px] font-medium text-gray-700 transition-colors hover:text-primary lg:text-[14px] lg:font-normal'
          }
        >
          {link.label}
        </Link>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? 'Hide services menu' : 'Show services menu'}
          className="flex size-4 items-center justify-center rounded transition-colors hover:text-primary"
        >
          <ChevronDownIcon
            className={`size-3.5 text-gray-500 transition-transform duration-200 ${
              open ? 'rotate-180 text-primary' : ''
            }`}
          />
        </button>
      </div>

      {active && <span className="mt-1 h-0.5 w-3 rounded-[1px] bg-accent lg:w-4" />}

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-3 flex w-[260px] -translate-x-1/2 animate-rise flex-col gap-0.5 rounded-card border border-gray-200 bg-white p-2 shadow-lg motion-reduce:animate-none">
          {SERVICE_LINKS.map((service) => (
            <Link
              key={service.href}
              to={service.href}
              onClick={() => setOpen(false)}
              className={
                pathname === service.href
                  ? 'rounded-lg bg-primary-light px-3 py-2 text-[13px] font-semibold text-primary'
                  : 'rounded-lg px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-primary'
              }
            >
              {service.label}
            </Link>
          ))}
          <Link
            to="/services"
            onClick={() => setOpen(false)}
            className="mt-1 rounded-lg border-t border-gray-200 px-3 pb-2 pt-3 text-[13px] font-semibold text-primary hover:underline"
          >
            All services &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

/*
 * The design draws the active link with an accent tick under it and gives the
 * rest no hover state at all. The tick is reproduced as drawn; the inactive
 * links pick up the shared growing underline and a colour shift, because a
 * navigation row where nothing answers the pointer reads as static text.
 */
function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  if (active) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Link
          to={link.href}
          className="whitespace-nowrap text-[13px] font-semibold text-primary lg:text-[14px] lg:font-medium"
        >
          {link.label}
        </Link>
        <span className="h-0.5 w-3 rounded-[1px] bg-accent lg:w-4" />
      </div>
    );
  }

  return (
    <Link
      to={link.href}
      className="link-underline whitespace-nowrap text-[13px] font-medium text-gray-700 transition-colors hover:text-primary lg:text-[14px] lg:font-normal"
    >
      {link.label}
    </Link>
  );
}
