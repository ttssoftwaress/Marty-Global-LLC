import { Link } from 'react-router-dom';

import { CookiePreferences } from '../components/legal/CookiePreferences';
import {
  LegalList,
  LegalPageLayout,
  LegalSection,
  type LegalSectionMeta,
} from '../components/legal/LegalPageLayout';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';
import { EFFECTIVE_DATE, PRIVACY_EMAIL } from './legal-constants';

/*
 * Cookie Policy — marketing page (`/legal/cookies`). The footer labels this link
 * "Cookie Settings", so the page leads with the working preference panel and
 * explains the categories underneath: someone arriving from that link wants the
 * control, not the essay.
 *
 * The cookie table lists only storage this system genuinely uses — the session,
 * the device-account flag, the bot-protection challenge, the consent record
 * itself, and the optional analytics category.
 */

const SECTIONS: LegalSectionMeta[] = [
  { id: 'preferences', title: 'Manage your preferences' },
  { id: 'what-are-cookies', title: 'What cookies are' },
  { id: 'cookies-we-use', title: 'The cookies we use' },
  { id: 'third-parties', title: 'Third parties' },
  { id: 'browser-controls', title: 'Browser-level controls' },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact us' },
];

type CookieRow = {
  name: string;
  purpose: string;
  category: 'Strictly necessary' | 'Analytics';
  duration: string;
};

const COOKIE_ROWS: CookieRow[] = [
  {
    name: 'Session',
    purpose:
      'Keeps you signed in to the customer or admin portal as you move between pages.',
    category: 'Strictly necessary',
    duration: 'Until you sign out, or up to 30 days with "Remember me"',
  },
  {
    name: 'Device account flag',
    purpose:
      'Remembers that an account was created on this browser, so "Get Started" takes you to sign-in rather than sign-up. Anonymous — it holds no name or email.',
    category: 'Strictly necessary',
    duration: 'Until you clear site data',
  },
  {
    name: 'Bot protection',
    purpose:
      'Set by our bot-protection service when you submit a public form, to confirm the submission came from a person and not a script.',
    category: 'Strictly necessary',
    duration: 'Session',
  },
  {
    name: 'Cookie preference',
    purpose:
      'Stores the choice you make on this page, so we do not have to ask again on every visit.',
    category: 'Strictly necessary',
    duration: 'Until you clear site data',
  },
  {
    name: 'Guest chat session',
    purpose:
      'Links you back to your live-chat conversation if you reload the page mid-question, before you have an account.',
    category: 'Strictly necessary',
    duration: 'Session',
  },
  {
    name: 'Product analytics',
    purpose:
      'Records which pages are viewed and how visitors move through the site, in aggregate, so we can improve it. Loads only if you turn analytics on above.',
    category: 'Analytics',
    duration: 'Up to 12 months',
  },
];

export function CookiePolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Cookie Policy & Settings — Marty Global LLC"
        description="What cookies Marty Global LLC uses, why we use them, and how to change your preferences. Analytics cookies are optional and off until you turn them on."
        path="/legal/cookies"
      />
      <Navbar />
      <main className="flex-1">
        <LegalPageLayout
          eyebrow="Legal"
          title="Cookie Policy & Settings"
          intro="This page explains the cookies and similar storage we use, and lets you change what you allow. Only the cookies that keep you signed in and protect our forms are required — everything else is your choice, and analytics stays off until you say otherwise."
          effectiveDate={EFFECTIVE_DATE}
          sections={SECTIONS}
        >
          <LegalSection id="preferences" title="Manage your preferences">
            <p>
              Set what you allow below. Your choice is saved on this browser, so
              you may need to set it again on another device or after clearing
              your site data.
            </p>
            <CookiePreferences />
          </LegalSection>

          <LegalSection id="what-are-cookies" title="What cookies are">
            <p>
              Cookies are small files a website stores in your browser so it can
              recognise you on your next request. We also use two related
              browser technologies — local storage and session storage — which do
              the same job and are covered by the same choices on this page.
            </p>
            <p>
              Cookies fall into two groups here. Strictly necessary ones make the
              service function: without a session cookie there is no way to stay
              signed in between pages. Optional ones help us improve the site but
              are not required to use it, and we do not set them without your
              agreement.
            </p>
          </LegalSection>

          <LegalSection id="cookies-we-use" title="The cookies we use">
            <p>
              This is the complete list. We do not use advertising cookies, and
              we do not allow third parties to track you across other websites
              from ours.
            </p>
            <CookieTable rows={COOKIE_ROWS} />
          </LegalSection>

          <LegalSection id="third-parties" title="Third parties">
            <p>
              A few cookies are set by the services we use to run the site rather
              than by us directly: our bot-protection provider on public forms,
              and our analytics provider if you have allowed analytics. They act
              on our instructions and, in the case of analytics, only once you
              have opted in.
            </p>
            <p>
              Our error-monitoring runs without cookies and without recording
              personal information in reports.
            </p>
            <p>
              How these providers handle information is covered in our{' '}
              <Link
                to="/legal/privacy"
                className="font-medium text-primary underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </LegalSection>

          <LegalSection
            id="browser-controls"
            title="Browser-level controls"
          >
            <p>
              Beyond the settings above, your browser can block or delete cookies
              for any site. Those controls sit under Settings → Privacy in every
              major browser, and they override anything set here.
            </p>
            <LegalList
              items={[
                'Blocking strictly necessary cookies will stop you signing in, and public forms will refuse submissions because the bot-protection check cannot complete.',
                'Clearing site data erases your cookie preference, so analytics returns to off and this page will show no recorded choice.',
                'Many browsers also send a "Do Not Track" or Global Privacy Control signal. We treat a Global Privacy Control signal as a request to keep optional cookies off.',
              ]}
            />
          </LegalSection>

          <LegalSection id="changes" title="Changes to this policy">
            <p>
              If we add a cookie category or change what an existing one does, we
              update this page and ask for your choice again — an old answer
              cannot cover a question we had not yet asked. The effective date at
              the top reflects the current version.
            </p>
          </LegalSection>

          <LegalSection id="contact" title="Contact us">
            <p>
              Questions about cookies or how we handle your information go to{' '}
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="font-medium text-primary underline underline-offset-2"
              >
                {PRIVACY_EMAIL}
              </a>
              , or use our{' '}
              <Link
                to="/contact"
                className="font-medium text-primary underline underline-offset-2"
              >
                contact page
              </Link>
              .
            </p>
          </LegalSection>
        </LegalPageLayout>
      </main>
      <Footer />
    </div>
  );
}

/*
 * The cookie list. A real table from `md` up where the columns fit; a stack of
 * labelled cards below that, because a four-column table on a 375px screen is
 * either unreadable or a horizontal scroll nobody discovers.
 */
function CookieTable({ rows }: { rows: CookieRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-gray-200 md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-[13px] font-semibold text-text">
                Cookie
              </th>
              <th className="px-4 py-3 text-[13px] font-semibold text-text">
                Purpose
              </th>
              <th className="px-4 py-3 text-[13px] font-semibold text-text">
                Category
              </th>
              <th className="px-4 py-3 text-[13px] font-semibold text-text">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-gray-200">
                <td className="px-4 py-3 align-top text-[13px] font-medium text-text">
                  {row.name}
                </td>
                <td className="px-4 py-3 align-top text-[13px] leading-[20px] text-text-secondary">
                  {row.purpose}
                </td>
                <td className="px-4 py-3 align-top">
                  <CategoryBadge category={row.category} />
                </td>
                <td className="px-4 py-3 align-top text-[13px] leading-[20px] text-text-secondary">
                  {row.duration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.name}
            className="flex flex-col gap-2 rounded-card border border-gray-200 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-text">{row.name}</p>
              <CategoryBadge category={row.category} />
            </div>
            <p className="text-[13px] leading-[20px] text-text-secondary">
              {row.purpose}
            </p>
            <p className="text-[12px] leading-[18px] text-gray-500">
              Duration: {row.duration}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function CategoryBadge({ category }: { category: CookieRow['category'] }) {
  return (
    <span
      className={`status-badge whitespace-nowrap ${
        category === 'Analytics' ? 'status-submitted' : 'status-draft'
      }`}
    >
      {category}
    </span>
  );
}
