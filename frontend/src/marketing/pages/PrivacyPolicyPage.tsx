import { Link } from 'react-router-dom';

import {
  LegalCallout,
  LegalList,
  LegalPageLayout,
  LegalSection,
  type LegalSectionMeta,
} from '../components/legal/LegalPageLayout';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';
import {
  CONTACT_EMAIL,
  EFFECTIVE_DATE,
  PRIVACY_EMAIL,
} from './legal-constants';

/*
 * Privacy Policy — marketing page (`/legal/privacy`). The footer links here
 * from every public page.
 *
 * The document describes what this system actually does: Better Auth accounts,
 * filing intake answers, scanned mail held in private R2, USDT transfers
 * matched on-chain, Socket.io support threads, and the SES/Twilio notification
 * queue. Every claim below is traceable to something built — no processor,
 * certification, or retention term is asserted that the codebase does not
 * support.
 */

const SECTIONS: LegalSectionMeta[] = [
  { id: 'who-we-are', title: 'Who we are' },
  { id: 'information-we-collect', title: 'Information we collect' },
  { id: 'how-we-use-it', title: 'How we use your information' },
  { id: 'legal-bases', title: 'Legal bases for processing' },
  { id: 'sharing', title: 'When we share information' },
  { id: 'storage-security', title: 'Storage and security' },
  { id: 'retention', title: 'How long we keep it' },
  { id: 'your-rights', title: 'Your rights' },
  { id: 'cookies', title: 'Cookies and analytics' },
  { id: 'international', title: 'International transfers' },
  { id: 'children', title: "Children's privacy" },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact us' },
];

export function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Privacy Policy — Marty Global LLC"
        description="How Marty Global LLC collects, uses, stores, and protects your personal information when you use our company formation, registered agent, and virtual mail room services."
        path="/legal/privacy"
      />
      <Navbar />
      <main className="flex-1">
        <LegalPageLayout
          eyebrow="Legal"
          title="Privacy Policy"
          intro="This policy explains what personal information Marty Global LLC collects when you use our services, why we collect it, who we share it with, and the choices you have. We have written it in plain language rather than boilerplate."
          effectiveDate={EFFECTIVE_DATE}
          sections={SECTIONS}
        >
          <LegalSection id="who-we-are" title="Who we are">
            <p>
              Marty Global LLC ("Marty Global", "we", "us") is a corporate
              filing service provider. We help founders form companies, maintain
              registrations, receive and digitise business mail, and manage the
              related paperwork through our online portal.
            </p>
            <p>
              This policy covers our marketing website, the customer portal, and
              the services delivered through them. We are the controller of the
              personal information described here.
            </p>
            <LegalCallout title="We are not a law firm">
              Marty Global LLC is a filing service provider, not a law firm, and
              we do not provide legal advice or act as your attorney. Nothing on
              this page or in our services creates an attorney–client
              relationship, and no communication with us is protected by legal
              privilege.
            </LegalCallout>
          </LegalSection>

          <LegalSection
            id="information-we-collect"
            title="Information we collect"
          >
            <p>
              We collect only what a filing service needs to do its work. In
              practice that falls into six groups.
            </p>
            <LegalList
              items={[
                <>
                  <strong className="font-semibold text-text">
                    Account information.
                  </strong>{' '}
                  Your name, email address, and password credentials, handled by
                  our authentication provider. We never see or store your
                  password in readable form.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Filing and application details.
                  </strong>{' '}
                  The answers you give when ordering a service — proposed
                  company names, addresses, ownership and director details, tax
                  identification numbers, and any identity documents a
                  jurisdiction requires. This is the most sensitive information
                  we hold, and it exists because registries require it.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Mail room content.
                  </strong>{' '}
                  If you use a virtual mail room, we receive physical mail
                  addressed to your registered address, record its sender and
                  arrival date, and store the scanned images we make of it.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Payment information.
                  </strong>{' '}
                  Invoices, quotes, amounts owed, and — for settlements in USDT
                  (TRC-20) — the wallet address you pay from and the transaction
                  hash that settles it. Blockchain transactions are public by
                  nature; we record ours to match your payment to your order.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Support conversations.
                  </strong>{' '}
                  Messages you send us through live chat, the portal's messaging
                  screen, email, or the contact form, together with the order
                  they concern.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Technical and usage information.
                  </strong>{' '}
                  Your IP address, browser and device type, and pages viewed.
                  This is used to keep the service secure, diagnose errors, and
                  — only where you have consented — understand how the site is
                  used.
                </>,
              ]}
            />
            <p>
              We do not collect payment card numbers or security codes. Card
              payments are not currently offered, and we hold no field, log, or
              endpoint capable of storing card details.
            </p>
          </LegalSection>

          <LegalSection id="how-we-use-it" title="How we use your information">
            <LegalList
              items={[
                'To deliver the services you order — preparing and submitting filings, maintaining registrations, and acting as your registered agent where engaged.',
                'To operate your virtual mail room: receiving, scanning, notifying you about, and forwarding your mail.',
                'To issue quotes and invoices, and to match incoming USDT transfers to the order they pay for.',
                'To answer your questions through live chat, messages, and email, and to keep a record of what was agreed.',
                'To send service notifications by email and SMS — order status changes, new scanned mail, payment confirmations, and filing deadlines.',
                'To keep the service secure: detecting abuse, rate-limiting, verifying that form submissions come from a person, and investigating incidents.',
                'To meet our own legal, accounting, and record-keeping obligations.',
                'To understand how our website is used, where — and only where — you have given consent for analytics.',
              ]}
            />
            <p>
              We do not sell your personal information, and we do not share it
              with advertisers or data brokers.
            </p>
          </LegalSection>

          <LegalSection id="legal-bases" title="Legal bases for processing">
            <p>
              Where the GDPR, UK GDPR, or a comparable regime applies to you, we
              rely on the following bases.
            </p>
            <LegalList
              items={[
                <>
                  <strong className="font-semibold text-text">
                    Performance of a contract
                  </strong>{' '}
                  — processing your filing details, mail, and payments so we can
                  deliver the services you ordered.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Legal obligation
                  </strong>{' '}
                  — retaining filing and payment records, and meeting
                  identity-verification requirements imposed on us or on the
                  registries we file with.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Legitimate interests
                  </strong>{' '}
                  — securing the service against fraud and abuse, diagnosing
                  faults, and keeping records of what we agreed with you. We
                  balance these against your rights and use the least
                  information that achieves the purpose.
                </>,
                <>
                  <strong className="font-semibold text-text">Consent</strong> —
                  optional analytics cookies and marketing emails. You can
                  withdraw consent at any time without affecting the services you
                  have already ordered.
                </>,
              ]}
            />
          </LegalSection>

          <LegalSection id="sharing" title="When we share information">
            <p>
              We share personal information only where it is necessary to
              deliver the service or where the law requires it.
            </p>
            <LegalList
              items={[
                <>
                  <strong className="font-semibold text-text">
                    Government registries and filing authorities.
                  </strong>{' '}
                  Filing a company is, by design, a submission to a public
                  authority. Much of what a registry publishes — company name,
                  registered address, and in many jurisdictions the names of
                  directors and owners — becomes a matter of public record that
                  we cannot withdraw or control.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Service providers who operate our infrastructure.
                  </strong>{' '}
                  Our hosting and database providers, our object storage
                  provider for documents and mail scans, our email and SMS
                  delivery providers, our error-monitoring and analytics
                  providers, and the bot-protection service on our public forms.
                  Each processes information on our instructions only.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Partners delivering a specific service.
                  </strong>{' '}
                  Where a service you ordered depends on a third party — a mail
                  handling facility, a registered agent in a jurisdiction we do
                  not cover directly — we pass only the details that party needs.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Legal and safety disclosures.
                  </strong>{' '}
                  Where we are required by law, court order, or a valid request
                  from a competent authority, or where disclosure is necessary to
                  establish or defend a legal claim.
                </>,
                <>
                  <strong className="font-semibold text-text">
                    Business transfers.
                  </strong>{' '}
                  If our business is merged or acquired, your information may
                  transfer with it. We will tell you before that happens and this
                  policy will continue to apply until you are given notice of a
                  replacement.
                </>,
              ]}
            />
          </LegalSection>

          <LegalSection id="storage-security" title="Storage and security">
            <LegalList
              items={[
                'Identity documents, filing paperwork, and mail scans are held in private storage. They are never publicly accessible; access is granted through short-lived, single-use links issued only after we confirm you are signed in and that the file belongs to you.',
                'All traffic between your browser and our systems is encrypted in transit.',
                'Passwords are never stored in readable form, and staff cannot see them.',
                'Access to customer records is restricted by role, and staff see only the areas their role requires.',
                'Every change to a company record, filing, payment, or document is written to an audit log so we can reconstruct what happened and when.',
                'We deliberately do not hold private keys for any wallet. We observe incoming USDT transfers to credit your account; we cannot move, spend, or recover funds.',
              ]}
            />
            <p>
              No system is perfectly secure. If a breach affects your personal
              information and poses a risk to you, we will notify you and the
              relevant authority within the timeframes the law requires.
            </p>
          </LegalSection>

          <LegalSection id="retention" title="How long we keep it">
            <p>
              Retention is driven by the nature of the record, not by a single
              blanket period.
            </p>
            <LegalList
              items={[
                'Filing records, corporate documents, and payment records are kept for as long as the applicable corporate and tax rules require us to be able to produce them — typically several years after the engagement ends. These carry regulatory retention and are not deleted on request.',
                'Mail scans and mail room records are kept for the life of your mail room subscription and for a short period afterwards so you can retrieve anything outstanding.',
                'Support conversations are kept while your account is open, so context survives across staff and over time.',
                'Account details are kept while your account is open. When you close it, we remove what we are not required to keep and retain the rest in restricted form.',
                'Technical logs are kept for a short operational period and then discarded.',
              ]}
            />
          </LegalSection>

          <LegalSection id="your-rights" title="Your rights">
            <p>
              Depending on where you live, you may have the right to access a
              copy of your personal information, to correct it, to ask us to
              delete it, to object to or restrict certain processing, to receive
              it in a portable format, and to withdraw consent you previously
              gave.
            </p>
            <p>
              To exercise any of these, email{' '}
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="font-medium text-primary underline underline-offset-2"
              >
                {PRIVACY_EMAIL}
              </a>{' '}
              from the address on your account. We respond within one month, and
              we will tell you if we need longer or if we cannot act on part of
              your request.
            </p>
            <p>
              Deletion has limits we would rather state plainly than bury: we
              cannot delete a filing already submitted to a registry, information
              a registry has published, a transaction recorded on a public
              blockchain, or records we are legally required to retain. We will
              tell you exactly what we are keeping and why.
            </p>
            <p>
              If you are in the EEA or the UK and you are not satisfied with how
              we handled your request, you may complain to your local data
              protection authority.
            </p>
          </LegalSection>

          <LegalSection id="cookies" title="Cookies and analytics">
            <p>
              We use a small number of cookies. Some are essential — they keep
              you signed in and protect our forms from automated abuse, and the
              service does not work without them. Analytics cookies are optional
              and load only after you agree.
            </p>
            <p>
              The full list, and the controls to change your choice at any time,
              are on our{' '}
              <Link
                to="/legal/cookies"
                className="font-medium text-primary underline underline-offset-2"
              >
                Cookie Policy
              </Link>{' '}
              page.
            </p>
          </LegalSection>

          <LegalSection id="international" title="International transfers">
            <p>
              We serve founders worldwide and file in multiple jurisdictions, so
              your information may be processed in a country other than your own
              — including by the providers who host our infrastructure and by the
              registry you are filing with.
            </p>
            <p>
              Where information leaves the EEA or the UK, we rely on the transfer
              mechanisms the law provides, such as an adequacy decision or
              standard contractual clauses with the provider concerned.
            </p>
          </LegalSection>

          <LegalSection id="children" title="Children's privacy">
            <p>
              Our services are for people forming and running businesses and are
              not directed at children. We do not knowingly collect information
              from anyone under 18. If you believe a minor has given us
              information, contact us and we will remove it.
            </p>
          </LegalSection>

          <LegalSection id="changes" title="Changes to this policy">
            <p>
              We update this policy when our services or obligations change. The
              effective date at the top always reflects the current version. If a
              change materially affects how we use your information, we will tell
              you by email or through the portal before it takes effect.
            </p>
          </LegalSection>

          <LegalSection id="contact" title="Contact us">
            <p>
              For privacy questions or to exercise your rights, email{' '}
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="font-medium text-primary underline underline-offset-2"
              >
                {PRIVACY_EMAIL}
              </a>
              . For anything else, email{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>{' '}
              or use our{' '}
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
