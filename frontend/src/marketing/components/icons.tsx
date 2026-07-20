import type { SVGProps } from 'react';

/*
 * Marketing icon set — standard Lucide glyphs inlined so marketing chrome
 * renders without pulling in an icon dependency. Stroke width follows the
 * design system icon token.
 */

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

/*
 * Hero glyphs — Lucide outline icons for the trust badges (building, globe,
 * star) and the dashboard-preview chrome (calendar, bell, trending-up).
 * Inlined to keep marketing chrome dependency-free; parent sets color/size.
 */
function lineIconProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}

export function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

export function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.5 15.09 8.76 22 9.77l-5 4.87 1.18 6.88L12 18.27 5.82 21.52 7 14.64l-5-4.87 6.91-1.01L12 2.5Z" />
    </svg>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </svg>
  );
}

export function TrendingUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M16 7h6v6" />
      <path d="m22 7-8.5 8.5-5-5L2 17" />
    </svg>
  );
}

/*
 * Services glyphs — Lucide outline icons for the services cards (briefcase,
 * piggy-bank, mail-open) and the registered-agent note (shield-check). Same
 * inlined-Lucide convention as the hero glyphs; parent sets color/size.
 */
export function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  );
}

export function PiggyBankIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-3V3a4 4 0 0 0-3.2 1.6l-.3.4a4 4 0 0 0-2.1-.6H8a5 5 0 0 0-5 5v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" />
      <path d="M16 10h.01" />
      <path d="M2 8v1a2 2 0 0 0 2 2h1" />
    </svg>
  );
}

export function MailOpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0z" />
      <path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />
    </svg>
  );
}

export function ShieldCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/*
 * Services-grid glyphs — Lucide outline check (bullet lists) and shopping-cart
 * (e-commerce card). Same inlined-Lucide convention as the other glyphs; parent
 * sets color/size.
 */
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ShoppingCartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

/*
 * Why-Choose-Us glyphs — Lucide outline zap, user, and shuffle for the value
 * props (globe is shared with the hero above). Same inlined-Lucide convention;
 * parent sets color/size.
 */
export function ZapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function ShuffleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="m18 14 4 4-4 4" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
      <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
      <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
    </svg>
  );
}

/*
 * FAQ glyph — Lucide chevron-down for the accordion toggle. Same inlined-Lucide
 * convention as the other glyphs; parent sets color/size and rotates it open.
 */
export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...lineIconProps(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/*
 * Footer social glyphs — outline (stroke) style matching the Figma export.
 * Paths are the exact vectors from the design, drawn in a 17-unit box with a
 * 2px stroke; `currentColor` lets the parent set the color.
 */
function socialIconProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 17 17',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export function LinkedInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...socialIconProps(props)}>
      <path d="M14.3389 6.91104C13.5418 6.11398 12.4607 5.66619 11.3335 5.66619C10.2062 5.66619 9.12512 6.11398 8.32803 6.91104C7.53094 7.70811 7.08314 8.78916 7.08314 9.91637V14.8749H9.9167V9.91637C9.9167 9.54063 10.066 9.18028 10.3317 8.9146C10.5974 8.64891 10.9577 8.49965 11.3335 8.49965C11.7092 8.49965 12.0696 8.64891 12.3353 8.9146C12.601 9.18028 12.7503 9.54063 12.7503 9.91637V14.8749H15.5838V9.91637C15.5838 8.78916 15.136 7.70811 14.3389 6.91104Z" />
      <path d="M4.24958 6.37456H1.41602V14.8749H4.24958V6.37456Z" />
      <path d="M2.8328 4.24947C3.61526 4.24947 4.24958 3.61518 4.24958 2.83274C4.24958 2.05031 3.61526 1.41602 2.8328 1.41602C2.05033 1.41602 1.41602 2.05031 1.41602 2.83274C1.41602 3.61518 2.05033 4.24947 2.8328 4.24947Z" />
    </svg>
  );
}

export function TwitterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...socialIconProps(props)}>
      <path d="M14.167 5.24114C15.0879 4.32027 15.5838 2.8327 15.5838 2.8327C15.5838 2.8327 14.2379 3.68274 13.4586 3.68274C11.3335 1.69931 7.86236 3.39939 8.49992 6.37453C6.09139 6.44536 3.68286 5.38282 2.12441 3.54106C0.353431 6.79955 2.12441 10.9789 5.66636 12.0415C4.53293 13.0332 2.97447 13.529 1.41602 13.4582C7.50817 17.4959 15.3005 12.3248 14.167 5.24114Z" />
    </svg>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...socialIconProps(props)}>
      <path d="M10.6252 1.41602H12.7501V4.24958H10.6252C10.4374 4.24958 10.2572 4.32421 10.1244 4.45706C9.99158 4.58991 9.91696 4.77009 9.91696 4.95797V7.08314H12.7501L12.0418 9.9167H9.91696V15.5838H7.08383V9.9167H4.95898V7.08314H7.08383V4.95797C7.08383 4.01858 7.45694 3.11767 8.12108 2.45343C8.78523 1.78918 9.686 1.41602 10.6252 1.41602Z" />
    </svg>
  );
}

export function YoutubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...socialIconProps(props)}>
      <path d="M1.77003 4.95864C1.27522 7.29354 1.27522 9.7062 1.77003 12.0411C1.83505 12.2782 1.96067 12.4943 2.13453 12.6682C2.3084 12.842 2.52453 12.9676 2.76167 13.0326C6.56064 13.6621 10.4373 13.6621 14.2363 13.0326C14.4734 12.9676 14.6895 12.842 14.8634 12.6682C15.0373 12.4943 15.1629 12.2782 15.2279 12.0411C15.7227 9.7062 15.7227 7.29354 15.2279 4.95864C15.1629 4.72153 15.0373 4.50542 14.8634 4.33156C14.6895 4.15771 14.4734 4.0321 14.2363 3.9671C10.4373 3.33779 6.56065 3.33779 2.76167 3.9671C2.52453 4.0321 2.3084 4.15771 2.13453 4.33156C1.96067 4.50542 1.83505 4.72153 1.77003 4.95864Z" />
    </svg>
  );
}
