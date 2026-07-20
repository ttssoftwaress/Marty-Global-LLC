import type { ReactNode } from 'react';

import { BellIcon, CheckIcon, ShieldCheckIcon } from '../icons';

/*
 * How It Works — Dashboard Review section. A section header sits above a preview
 * layout that pairs a SaaS-window mockup with a set of feature bullets. Three
 * breakpoints per Figma:
 *   - mobile (<768px):  bg-gray-50, px-5 py-12, 32px gap. The header carries an
 *     eyebrow pill; heading 28px/1.25. The mockup has NO sidebar (body is just
 *     the "Your Services" panel) and lists three rows; radius 12px, header 44px.
 *     Mockup and bullets stack; bullets show two items.
 *   - tablet (md, 768px): bg-white, px-10 py-16, 40px gap. No eyebrow; heading
 *     32px. The mockup gains a 160px sidebar (4 links), 360px body, three rows;
 *     radius 16px, header 48px. Mockup and bullets stack; three bullets.
 *   - desktop (lg, 1024px): bg-white, p-20, 48px gap. No eyebrow; heading 40px,
 *     body capped at 800px. Mockup (720px) and bullets sit side by side (gap
 *     48px, centered). Sidebar 200px (5 links), 400px body, five rows; header
 *     56px. Three bullets.
 * The window's traffic-light controls and status pills are decorative mockup
 * chrome; the bullet glyphs reuse the shared icon set.
 */

type Bullet = {
  Icon: (props: { className?: string }) => ReactNode;
  title: string;
  /*
   * The bell bullet's title is shorter on mobile/tablet ("Get notified
   * instantly") than on desktop ("Get notified the moment your status
   * changes"); when both are set, the compact title shows below lg.
   */
  compactTitle?: string;
  description: string;
  /* The shield bullet is hidden on mobile per Figma. */
  hideOnMobile?: boolean;
};

const BULLETS: Bullet[] = [
  {
    Icon: CheckIcon,
    title: 'Track every order in one place',
    description:
      'Never wonder about state processing speeds. Check current task states instantly.',
  },
  {
    Icon: BellIcon,
    title: 'Get notified the moment your status changes',
    compactTitle: 'Get notified instantly',
    description:
      'Receive secure scanning briefs, compliance updates, and regulatory notices automatically.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Upload documents and pay securely',
    description:
      'All transactions are encrypted. Access tailored corporate bank rates easily.',
    hideOnMobile: true,
  },
];

type ServiceStatus = 'completed' | 'approved' | 'review' | 'submitted' | 'missing';

type ServiceRow = {
  name: string;
  status: ServiceStatus;
  label: string;
};

/*
 * Full row set for tablet/desktop; mobile shows only the first three. Desktop
 * renders all five, tablet trims the trailing two. Each row's status maps to the
 * design-system status-badge palette.
 */
const SERVICE_ROWS: ServiceRow[] = [
  { name: 'LLC Filing Form', status: 'completed', label: 'Completed' },
  { name: 'Virtual Address Setup', status: 'approved', label: 'Approved' },
  { name: 'Registered Agent Bond', status: 'review', label: 'Under Review' },
  { name: 'Corporate Bank Route', status: 'submitted', label: 'Submitted' },
  { name: 'VAT/EIN Registration', status: 'missing', label: 'Missing Info' },
];

const STATUS_CLASS: Record<ServiceStatus, string> = {
  completed: 'status-completed',
  approved: 'status-approved',
  review: 'status-review',
  submitted: 'status-submitted',
  missing: 'status-missing',
};

export function HowItWorksDashboardSection() {
  return (
    <section className="flex w-full flex-col items-start gap-8 bg-gray-50 px-5 py-12 md:gap-10 md:bg-white md:px-10 md:py-16 lg:gap-12 lg:p-20">
      <div className="flex w-full flex-col items-start gap-3 lg:w-[800px] lg:gap-4">
        <span className="inline-flex items-center rounded-pill bg-primary-light px-4 py-1.5 text-[11px] font-bold uppercase text-primary md:hidden">
          Dashboard Command
        </span>
        <h2 className="w-full font-marketing text-[28px] font-bold leading-[1.25] text-text md:text-[32px] md:leading-normal lg:text-[40px]">
          Your Dashboard: Everything in One Place
        </h2>
        <p className="w-full text-[14px] font-normal leading-[1.5] text-text-secondary md:text-[15px] md:leading-normal lg:text-[16px]">
          Once registered, you gain access to an intuitive command center built
          for global teams.
        </p>
      </div>

      <div className="flex w-full flex-col items-start gap-10 lg:flex-row lg:items-center lg:gap-12">
        <DashboardMockup />
        <div className="flex w-full flex-col items-start gap-5 md:gap-6 lg:flex-1 lg:gap-8">
          {BULLETS.map((bullet) => (
            <FeatureBullet key={bullet.title} {...bullet} />
          ))}
        </div>
      </div>
    </section>
  );
}

/*
 * The SaaS-window mockup. A traffic-light header sits atop a body that, on
 * tablet+, splits into a nav sidebar and the services panel; on mobile the body
 * is the panel alone. Row count steps up with the breakpoint (3 → 3 → 5).
 */
function DashboardMockup() {
  return (
    <div className="flex w-full flex-col items-start overflow-clip rounded-[12px] border border-gray-200 bg-white shadow-[0px_12px_24px_0px_rgba(3,18,109,0.06)] md:rounded-card md:shadow-[0px_16px_32px_0px_rgba(3,18,109,0.06)] lg:w-[720px]">
      <div className="flex h-11 w-full items-center justify-between border-b border-gray-200 bg-gray-50 px-4 md:h-12 md:px-5 lg:h-14 lg:px-6">
        <WindowControls />
        <p className="whitespace-nowrap text-[11px] font-semibold text-gray-400 md:text-[12px] lg:text-[13px]">
          dashboard.martyglobal.com
        </p>
        <span aria-hidden className="w-4 md:w-8 lg:w-10" />
      </div>

      <div className="flex w-full items-start md:h-[360px] lg:h-[400px]">
        <nav className="hidden h-full shrink-0 flex-col items-start gap-3 whitespace-nowrap border-r border-gray-200 bg-gray-50 p-4 text-[12px] md:flex md:w-[160px] lg:w-[200px] lg:gap-4 lg:p-5 lg:text-[13px]">
          <span className="font-bold text-primary">Dashboard</span>
          <span className="font-medium text-gray-500">Your Entities</span>
          <span className="font-medium text-gray-500">Mail Room</span>
          <span className="font-medium text-gray-500 lg:hidden">
            Integrations
          </span>
          <span className="hidden font-medium text-gray-500 lg:inline">
            Banking Integrations
          </span>
          <span className="hidden font-medium text-gray-500 lg:inline">
            Billing &amp; Quotes
          </span>
        </nav>

        <div className="flex w-full flex-1 flex-col items-start gap-4 p-4 md:gap-4 md:p-[18px] lg:min-w-0 lg:gap-5 lg:p-6">
          <div className="flex w-full items-center justify-between">
            <h3 className="whitespace-nowrap font-marketing text-[15px] font-bold text-text md:text-[16px] lg:text-[20px]">
              Your Services
            </h3>
            <div className="rounded-[6px] bg-primary-light px-2 py-[3px] md:px-2 md:py-1 lg:rounded-lg lg:px-3 lg:py-1">
              <span className="whitespace-nowrap text-[9px] font-bold text-primary md:text-[10px] lg:text-[11px]">
                <span className="lg:hidden">
                  <span className="md:hidden">US Delaware LLC</span>
                  <span className="hidden md:inline">Delaware LLC</span>
                </span>
                <span className="hidden lg:inline">US Delaware LLC</span>
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-2 lg:gap-2.5">
            {SERVICE_ROWS.map((row, index) => (
              <div
                key={row.name}
                className={`flex w-full items-center justify-between border-b border-gray-200 pb-1.5 lg:pb-2 ${
                  index >= 3 ? 'hidden lg:flex' : 'flex'
                }`}
              >
                <span className="whitespace-nowrap text-[12px] font-semibold text-gray-700 lg:text-[13px]">
                  {row.name}
                </span>
                <span
                  className={`inline-flex items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-[10px] font-semibold lg:px-3 lg:py-1 lg:text-[12px] ${STATUS_CLASS[row.status]}`}
                >
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* The window traffic-light controls — three decorative dots. */
function WindowControls() {
  return (
    <div className="flex items-center gap-1.5 lg:gap-2">
      <span className="size-2 rounded-pill bg-error lg:size-3" />
      <span className="size-2 rounded-pill bg-warning lg:size-3" />
      <span className="size-2 rounded-pill bg-success lg:size-3" />
    </div>
  );
}

function FeatureBullet({
  Icon,
  title,
  compactTitle,
  description,
  hideOnMobile,
}: Bullet) {
  return (
    <div
      className={`w-full items-start gap-3 lg:gap-4 ${
        hideOnMobile ? 'hidden md:flex' : 'flex'
      }`}
    >
      <div className="flex shrink-0 items-start rounded-[6px] bg-primary-light p-1.5 md:rounded-lg md:p-2">
        <Icon className="size-4 text-primary md:size-5" />
      </div>
      <div className="flex flex-1 flex-col items-start gap-0.5 lg:gap-1">
        <h3 className="font-marketing text-[15px] font-bold text-text md:text-[16px] lg:text-[18px]">
          {compactTitle ? (
            <>
              <span className="lg:hidden">{compactTitle}</span>
              <span className="hidden lg:inline">{title}</span>
            </>
          ) : (
            title
          )}
        </h3>
        <p className="w-full text-[13px] font-normal leading-normal text-text-secondary lg:text-[14px]">
          {description}
        </p>
      </div>
    </div>
  );
}
