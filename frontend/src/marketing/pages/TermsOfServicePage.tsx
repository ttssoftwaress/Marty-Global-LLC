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
import { EFFECTIVE_DATE, LEGAL_EMAIL } from './legal-constants';

/*
 * Terms of Service — marketing page (`/legal/terms`). The footer links here from
 * every public page, and the signup screen's consent checkbox points at it.
 *
 * The terms describe the engagement this system actually implements: a quote
 * issued after review, settlement in USDT (TRC-20), work starting once the
 * transfer confirms on-chain, and the mail room and registered agent
 * subscriptions. Two things get their own callouts because they are the terms
 * customers are most likely to be surprised by: we are not a law firm, and a
 * crypto transfer cannot be reversed.
 */

const SECTIONS: LegalSectionMeta[] = [
  { id: 'agreement', title: 'This agreement' },
  { id: 'what-we-do', title: 'What we do — and what we do not' },
  { id: 'accounts', title: 'Your account' },
  { id: 'your-obligations', title: 'Your responsibilities' },
  { id: 'ordering', title: 'Orders, quotes, and acceptance' },
  { id: 'payment', title: 'Payment' },
  { id: 'refunds', title: 'Refunds and cancellation' },
  { id: 'subscriptions', title: 'Ongoing services' },
  { id: 'mail-room', title: 'Virtual mail room' },
  { id: 'timelines', title: 'Timelines and government processing' },
  { id: 'acceptable-use', title: 'Acceptable use' },
  { id: 'intellectual-property', title: 'Intellectual property' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'liability', title: 'Limitation of liability' },
  { id: 'indemnity', title: 'Indemnity' },
  { id: 'suspension', title: 'Suspension and termination' },
  { id: 'changes', title: 'Changes to these terms' },
  { id: 'governing-law', title: 'Governing law and disputes' },
  { id: 'contact', title: 'Contact us' },
];

export function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Terms of Service — Marty Global LLC"
        description="The terms governing your use of Marty Global LLC's company formation, registered agent, and virtual mail room services, including orders, payment in USDT, refunds, and liability."
        path="/legal/terms"
      />
      <Navbar />
      <main className="flex-1">
        <LegalPageLayout
          eyebrow="Legal"
          title="Terms of Service"
          intro="These terms govern your use of Marty Global LLC's website, customer portal, and services. Please read them — particularly the sections on payment, refunds, and what we are not able to do for you."
          effectiveDate={EFFECTIVE_DATE}
          sections={SECTIONS}
        >
          <LegalSection id="agreement" title="This agreement">
            <p>
              These Terms of Service form a binding agreement between you and
              Marty Global LLC ("Marty Global", "we", "us"). They apply when you
              create an account, order a service, or otherwise use our website
              or portal.
            </p>
            <p>
              By creating an account or placing an order you accept these terms.
              If you are agreeing on behalf of a company, you confirm you are
              authorised to bind it, and "you" means that company.
            </p>
            <p>
              Our{' '}
              <Link
                to="/legal/privacy"
                className="font-medium text-primary underline underline-offset-2"
              >
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link
                to="/legal/cookies"
                className="font-medium text-primary underline underline-offset-2"
              >
                Cookie Policy
              </Link>{' '}
              form part of this agreement.
            </p>
          </LegalSection>

          <LegalSection
            id="what-we-do"
            title="What we do — and what we do not"
          >
            <p>
              We are a filing service provider. We prepare and submit the
              paperwork you instruct us to submit, act as registered agent where
              you engage us to, and operate virtual mail rooms.
            </p>
            <LegalCallout title="We are not a law firm and we do not give legal advice">
              Marty Global LLC is not a law firm, tax adviser, or accountancy
              practice, and our staff are not acting as your attorney. Nothing
              we publish or tell you is legal, tax, or financial advice, no
              attorney–client relationship is created, and no communication with
              us is privileged. Choosing a jurisdiction, an entity type, or an
              ownership structure has legal and tax consequences — take
              independent professional advice before you decide.
            </LegalCallout>
            <p>
              We act on your instructions. We do not verify that the structure
              you have chosen suits your circumstances, and we are not
              responsible for the consequences of that choice.
            </p>
          </LegalSection>

          <LegalSection id="accounts" title="Your account">
            <LegalList
              items={[
                'You must be at least 18 and legally able to enter into contracts.',
                'The information on your account must be accurate and kept up to date. We rely on your email address to send filing deadlines and payment confirmations.',
                'You are responsible for keeping your credentials secure and for everything done through your account. Tell us immediately if you suspect unauthorised access.',
                'One account per customer. Do not share a login across people who should have separate access.',
              ]}
            />
          </LegalSection>

          <LegalSection
            id="your-obligations"
            title="Your responsibilities"
          >
            <p>
              The quality of a filing depends entirely on the information you
              give us, and we submit what you provide.
            </p>
            <LegalList
              items={[
                'You warrant that everything you submit — names, addresses, ownership and director details, tax identifiers, and identity documents — is accurate, complete, and yours to provide.',
                'You must have the authority of every person whose details you submit, and you are responsible for having told them how their information will be used.',
                'You must respond to our requests for missing information or documents. A filing cannot proceed while it is incomplete, and government deadlines do not pause while we wait.',
                'You are responsible for your own ongoing obligations — annual reports, tax filings, licences, and beneficial-ownership disclosures — except where you have specifically engaged us for that service.',
                'You must not ask us to submit anything false or misleading to a government authority.',
              ]}
            />
            <p>
              If a filing is rejected, delayed, or has to be refiled because the
              information you gave us was wrong or incomplete, any government
              fee and any refiling fee are payable again.
            </p>
          </LegalSection>

          <LegalSection
            id="ordering"
            title="Orders, quotes, and acceptance"
          >
            <p>
              Placing an order through the portal is a request for service, not
              a concluded contract. The sequence is:
            </p>
            <LegalList
              items={[
                'You select the services you want and complete the application questions for each.',
                'We review what you submitted and may come back with questions or ask for documents.',
                'We issue a quote in your portal setting out the price, what it covers, and any government fees.',
                'You pay the quote. The contract for that service is formed when your payment is confirmed, and work begins then.',
              ]}
            />
            <p>
              We may decline an order. We will say so and will not charge you.
              Our marketing pages do not quote prices — an amount depends on the
              service, the jurisdiction, and that jurisdiction&rsquo;s government
              fees — so the itemised quote in your portal is the only figure that
              binds.
            </p>
          </LegalSection>

          <LegalSection id="payment" title="Payment">
            <p>
              Quotes are settled in USDT on the TRON network (TRC-20). Card
              payment is not currently available; the portal shows it as coming
              soon and nothing behind that option is active.
            </p>
            <LegalList
              items={[
                'Where a quote is denominated in US dollars, the USDT amount is fixed at the rate captured when the quote is issued. That rate holds until the quote expires; after expiry we reissue it at the current rate.',
                'Pay the exact amount to the exact address shown for that quote. We credit a payment by matching the address and amount to the transfer on-chain, and we credit it only once the network has confirmed it.',
                'Underpayments and overpayments are flagged rather than silently accepted. We will contact you to resolve them.',
                'Network fees charged by the TRON network are yours. Any government or registry fee is passed through at cost and is stated separately in the quote.',
                'Work starts once payment confirms on-chain. It does not start when a transfer is broadcast.',
              ]}
            />
            <LegalCallout title="Cryptocurrency transfers are final">
              A confirmed blockchain transfer cannot be reversed by us or by
              anyone else. Sending to a wrong address, on the wrong network, or
              in the wrong token will lose the funds permanently, and we cannot
              recover them. Check the address and the network before you send.
              We never hold private keys and we never ask you for a seed phrase
              or private key — anyone who does is not us.
            </LegalCallout>
          </LegalSection>

          <LegalSection id="refunds" title="Refunds and cancellation">
            <p>
              What is refundable depends on how far the work has gone.
            </p>
            <LegalList
              items={[
                'Before work begins on a paid order, you may cancel and we will refund the service fee.',
                'Once we have begun preparing your filing, we refund the portion of the service fee reflecting work not yet done.',
                'Government and registry fees are not refundable once submitted. Those authorities do not return them to us, and we cannot return what we do not receive.',
                'A filing that a registry rejects for a reason within our control is corrected and resubmitted at our cost.',
                'A filing rejected because of information you supplied is not refundable, and refiling fees apply.',
                'Subscriptions are refunded pro rata for the unused part of the current term where you cancel mid-term for a reason attributable to us.',
              ]}
            />
            <p>
              Refunds are returned by the method you paid with. A USDT payment is
              refunded in USDT to an address you nominate, less network fees, and
              at the USDT amount originally received rather than its value at any
              later date.
            </p>
          </LegalSection>

          <LegalSection id="subscriptions" title="Ongoing services">
            <p>
              Registered agent and virtual mail room services renew for
              successive terms until cancelled. We notify you before a renewal
              falls due, and you may cancel at any time before the next term
              begins.
            </p>
            <p>
              If a renewal goes unpaid, we may suspend the service. For
              registered agent services this matters: lapsing can put your
              company out of good standing with the registry, and reinstatement
              is a separate, chargeable process. We will warn you before it
              reaches that point, but the obligation to keep the service current
              is yours.
            </p>
          </LegalSection>

          <LegalSection id="mail-room" title="Virtual mail room">
            <LegalList
              items={[
                'A virtual mail room address may be used as a business or registered address for the entity it was issued to. It is not a residential address and must not be presented as one.',
                'We receive mail addressed to your entity at that address, scan it, and make the scans available in your portal.',
                'We may open and scan the contents of mail where your plan includes content scanning and you have authorised it. Some jurisdictions require a signed mail-handling authorisation before we may do so.',
                'We do not accept packages requiring payment on delivery, perishable goods, or anything unlawful to possess or ship.',
                'Unclaimed physical mail is held for the period stated in your plan and then securely destroyed. Scans remain available in the portal for the life of the subscription.',
                'Forwarding is charged at cost plus handling, and we are not liable for loss or delay once an item is with the carrier.',
              ]}
            />
          </LegalSection>

          <LegalSection
            id="timelines"
            title="Timelines and government processing"
          >
            <p>
              Any timeframe we quote is an estimate based on how a registry has
              recently been performing. Processing speed is controlled by the
              government authority, not by us, and it varies with backlogs,
              holidays, and rule changes.
            </p>
            <p>
              We do not guarantee that a filing will be accepted, that a
              particular company name will be available, or that any third party
              — including a bank — will approve an application. Where a service
              depends on a third party's decision, we deliver the filing, not the
              outcome.
            </p>
          </LegalSection>

          <LegalSection id="acceptable-use" title="Acceptable use">
            <p>You agree not to use our services to:</p>
            <LegalList
              items={[
                'commit or facilitate fraud, money laundering, sanctions evasion, or tax evasion;',
                'conceal beneficial ownership from an authority entitled to know it;',
                'submit false, forged, or altered documents to us or to a registry;',
                'operate a business that is unlawful in the jurisdiction where it is formed or operated;',
                'harass our staff, or abuse our support channels;',
                'attempt to gain unauthorised access to our systems, probe them, or disrupt them; or',
                'scrape, resell, or redistribute our services or content without our written permission.',
              ]}
            />
            <p>
              We screen customers and orders where the law requires it, and we
              may refuse or stop work — and report it — where we are obliged to.
            </p>
          </LegalSection>

          <LegalSection
            id="intellectual-property"
            title="Intellectual property"
          >
            <p>
              Our website, portal, branding, and the materials we produce for
              general use remain ours. You get a limited, non-transferable right
              to use them for your own business while your account is open.
            </p>
            <p>
              Documents we prepare specifically for your entity — formation
              deeds, filed articles, registry correspondence — are yours. The
              information you upload stays yours; you grant us only the licence
              we need to deliver the service.
            </p>
          </LegalSection>

          <LegalSection id="disclaimers" title="Disclaimers">
            <p>
              Our services are provided "as is" and "as available". To the
              fullest extent the law allows, we exclude implied warranties of
              merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
            <p>
              We do not warrant that the portal will be uninterrupted or
              error-free, that a filing will produce a particular legal or tax
              result, or that a jurisdiction will not change its rules after you
              have filed.
            </p>
            <p>
              Nothing here excludes liability that cannot lawfully be excluded,
              including for fraud, or for death or personal injury caused by
              negligence.
            </p>
          </LegalSection>

          <LegalSection id="liability" title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, neither party is liable to
              the other for indirect, incidental, special, consequential, or
              punitive damages, or for lost profits, revenue, data, or business
              opportunity, however caused.
            </p>
            <p>
              Our total aggregate liability arising out of or relating to a
              service is limited to the fees you paid us for that service in the
              twelve months before the claim arose.
            </p>
            <p>
              We are not liable for government fees, fines, or penalties incurred
              because of information you supplied, for delays caused by a
              registry or other authority, or for the acts of a third party you
              instructed us to deal with.
            </p>
          </LegalSection>

          <LegalSection id="indemnity" title="Indemnity">
            <p>
              You will indemnify Marty Global LLC and its staff against claims,
              losses, and reasonable costs arising from information you gave us
              that was false or incomplete, from your use of our services in
              breach of these terms or of the law, or from the operation of the
              entity we helped you form.
            </p>
          </LegalSection>

          <LegalSection
            id="suspension"
            title="Suspension and termination"
          >
            <p>
              You may close your account at any time. Ongoing services run to the
              end of their current term unless cancelled as described above.
            </p>
            <p>
              We may suspend or terminate your account where you materially
              breach these terms, where a payment is overdue, where we are
              legally required to, or where continuing would expose us to legal
              risk. Except where the law prevents it, we will tell you why and
              give you a chance to put it right first.
            </p>
            <p>
              On termination you keep access to your filed documents for a
              reasonable period so you can retrieve them, and the sections that
              are meant to survive — payment obligations, disclaimers, liability,
              indemnity, and governing law — continue to apply.
            </p>
          </LegalSection>

          <LegalSection id="changes" title="Changes to these terms">
            <p>
              We may update these terms as our services and obligations change.
              The effective date at the top reflects the current version. For a
              material change we will give notice by email or in the portal
              before it takes effect; continuing to use the services afterwards
              means you accept the updated terms. The terms that applied when you
              paid for a service continue to govern that service.
            </p>
          </LegalSection>

          <LegalSection
            id="governing-law"
            title="Governing law and disputes"
          >
            <p>
              These terms are governed by the laws of the State of Delaware,
              United States, without regard to its conflict-of-laws rules, and
              the state and federal courts located in Delaware have exclusive
              jurisdiction over any dispute.
            </p>
            <p>
              If you are a consumer resident elsewhere, this does not deprive you
              of the protection of mandatory rules of your own country, or of the
              right to bring proceedings there where the law gives you that
              right.
            </p>
            <p>
              Before starting proceedings, please contact us — most disputes are
              resolved faster by talking to us first.
            </p>
          </LegalSection>

          <LegalSection id="contact" title="Contact us">
            <p>
              Questions about these terms, or formal notices, go to{' '}
              <a
                href={`mailto:${LEGAL_EMAIL}`}
                className="font-medium text-primary underline underline-offset-2"
              >
                {LEGAL_EMAIL}
              </a>
              . For anything else, use our{' '}
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
