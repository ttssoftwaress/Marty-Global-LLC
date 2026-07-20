import {
  FacebookIcon,
  LinkedInIcon,
  TwitterIcon,
  YoutubeIcon,
} from '../icons';

/*
 * Marketing footer — shared chrome across every public marketing page. Dark
 * (Gray-900) section, matched to Figma across three breakpoints:
 *   - mobile (<768px): stacked — brand, link groups + newsletter, socials
 *   - tablet (md, 768px): two-column wrap — info+socials, newsletter, services,
 *     company; bottom bar centered
 *   - desktop (lg, 1024px): single row — info+socials, services, company,
 *     newsletter; bottom bar spread
 * `order-*` utilities reflow the same DOM into each layout so nothing is
 * duplicated across breakpoints.
 */

type FooterLink = {
  label: string;
  href: string;
};

const SERVICES: FooterLink[] = [
  { label: 'LLC Formation', href: '/services' },
  { label: 'Bank Account Opening', href: '/services' },
  { label: 'Virtual Mail Room', href: '/services' },
  { label: 'Registered Agent', href: '/services' },
  { label: 'Corporate Compliance', href: '/services' },
];

const COMPANY: FooterLink[] = [
  { label: 'About Us', href: '/about' },
  { label: 'Our Markets', href: '/about' },
  { label: 'Partner Program', href: '/about' },
  { label: 'Careers', href: '/about' },
  { label: 'Contact Center', href: '/contact' },
];

const LEGAL: FooterLink[] = [
  { label: 'Privacy Policy', href: '/legal/privacy' },
  { label: 'Terms of Service', href: '/legal/terms' },
  { label: 'Cookie Settings', href: '/legal/cookies' },
];

const SOCIALS = [
  { label: 'LinkedIn', href: '#', Icon: LinkedInIcon },
  { label: 'Twitter', href: '#', Icon: TwitterIcon },
  { label: 'Facebook', href: '#', Icon: FacebookIcon },
  { label: 'YouTube', href: '#', Icon: YoutubeIcon },
];

export function Footer() {
  return (
    <footer className="flex w-full flex-col gap-10 bg-gray-900 px-4 pb-8 pt-12 md:gap-12 md:px-10 md:pb-8 md:pt-16 lg:gap-16 lg:px-20 lg:pb-10 lg:pt-20">
      <div className="flex flex-col gap-7 md:flex-row md:flex-wrap md:gap-x-6 md:gap-y-8 lg:flex-nowrap lg:gap-12">
        {/* Info: logo + description + socials */}
        <div className="order-1 flex flex-col gap-4 md:w-[332px] md:gap-5 lg:order-1 lg:w-80 lg:gap-6">
          <FooterLogo />
          <p className="max-w-[520px] text-[13px] font-normal leading-5 text-gray-400 md:leading-5 lg:text-body lg:leading-[22px]">
            Providing premium, compliant corporate structures, financial
            integrations, and physical offices in key markets. Trusted globally.
          </p>
          <Socials className="mt-2 hidden md:flex md:mt-0" />
        </div>

        {/* Newsletter */}
        <div className="order-4 flex flex-col gap-3 md:order-2 md:w-[332px] md:gap-4 lg:order-4 lg:w-[340px] lg:gap-5">
          <h3 className="font-marketing text-[14px] font-semibold text-white md:text-[15px] lg:text-body-lg">
            Get Business Insights
          </h3>
          <p className="text-[12px] font-normal leading-[18px] text-gray-400 md:leading-normal lg:text-[13px]">
            Subscribe to receive weekly regulatory updates and global
            incorporation trends.
          </p>
          <NewsletterForm />
        </div>

        {/* Services */}
        <LinkColumn
          title="Services"
          links={SERVICES}
          className="order-2 md:order-3 md:w-[332px] lg:order-2 lg:flex-1"
        />

        {/* Company */}
        <LinkColumn
          title="Company"
          links={COMPANY}
          className="order-3 md:order-4 md:w-[332px] lg:order-3 lg:flex-1"
        />

        {/* Socials — mobile only, after the link groups */}
        <Socials className="order-5 flex md:hidden" />
      </div>

      <div className="h-px w-full bg-gray-800" />

      <BottomBar />
    </footer>
  );
}

function FooterLogo() {
  return (
    <div className="flex w-fit flex-col items-center gap-0.5 md:items-start lg:items-center">
      <span className="font-marketing text-[26px] font-extrabold leading-none text-white lg:text-[28px]">
        mart<span className="text-accent">y</span>
      </span>
      <div className="flex items-center gap-1.5 lg:gap-2">
        <span className="h-px w-3 bg-white lg:w-4" />
        <span className="font-marketing text-[9px] font-bold leading-none text-white lg:text-[10px]">
          GLOBAL LLC
        </span>
        <span className="h-px w-3 bg-white lg:w-4" />
      </div>
    </div>
  );
}

function LinkColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: FooterLink[];
  className?: string;
}) {
  return (
    <nav className={`flex flex-col gap-3 lg:gap-4 ${className ?? ''}`}>
      <h3 className="font-marketing text-[14px] font-semibold text-white md:text-[15px] lg:text-body-lg">
        {title}
      </h3>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          className="text-[13px] font-normal text-gray-400 transition-colors hover:text-white lg:text-body"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

function NewsletterForm() {
  return (
    <form
      className="flex w-full flex-col gap-2 md:flex-row md:items-center md:gap-2"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="email"
        placeholder="Enter your email"
        aria-label="Email address"
        className="h-11 w-full rounded-input border border-gray-700 bg-gray-800 px-4 text-[13px] text-white placeholder:text-gray-400 focus:border-primary focus:outline-none md:h-[42px] md:min-w-0 md:flex-1 md:rounded-[8px] lg:h-input lg:rounded-input lg:text-body"
      />
      <button
        type="submit"
        className="flex h-11 w-full items-center justify-center rounded-input bg-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover md:h-[42px] md:w-auto md:rounded-[8px] md:px-[14px] lg:h-input lg:rounded-input lg:px-4 lg:text-body"
      >
        Join
      </button>
    </form>
  );
}

function Socials({ className }: { className?: string }) {
  return (
    <div className={`items-center gap-3 lg:gap-4 ${className ?? ''}`}>
      {SOCIALS.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          aria-label={label}
          className="flex size-8 items-center justify-center rounded-pill bg-gray-800 text-white transition-colors hover:bg-primary lg:size-9"
        >
          <Icon className="size-[15px] lg:size-[17px]" />
        </a>
      ))}
    </div>
  );
}

function BottomBar() {
  return (
    <div className="flex flex-col gap-3 text-gray-500 md:gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <p className="text-[11px] leading-4 md:text-[12px] md:text-center lg:flex-1 lg:text-left lg:text-[13px] lg:leading-normal">
        © 2026 Marty Global LLC. All rights reserved. Registered across major
        global financial nodes.
      </p>
      <nav className="flex items-center gap-4 whitespace-nowrap text-[12px] md:justify-center md:gap-5 lg:gap-6 lg:text-[13px]">
        {LEGAL.map((link, i) => (
          <a
            key={link.label}
            href={link.href}
            className={`transition-colors hover:text-white ${
              i === LEGAL.length - 1 ? 'hidden md:inline' : ''
            }`}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
