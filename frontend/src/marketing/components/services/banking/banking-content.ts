import type { Faq } from '../../shared/FaqSection';
import {
  BellIcon,
  BriefcaseIcon,
  CreditCardIcon,
  FileTextIcon,
  GlobeIcon,
  LandmarkIcon,
  MailOpenIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  UserIcon,
} from '../../icons';
import type { QuickFact } from '../detail/ServiceDetailHero';
import type { ServiceFeature } from '../detail/ServiceFeatureGrid';
import type { RelatedService } from '../detail/ServiceRelatedSection';
import type { ServiceStep } from '../detail/ServiceStepGrid';

/*
 * Copy for `/services/banking`. The page composes the shared detail sections
 * (`services/detail/`) from this file plus its two service-specific sections —
 * where our work ends and the bank's begins, and what a customer needs to have
 * ready.
 *
 * Unlike the other service pages there is no catalog entry to ground this one
 * against (`seed-catalog.ts` scaffolds formation, agent, mail room, remote
 * desktop, and website), so the claims here stay inside what the Services page
 * already says: we match, prepare, and submit applications with partner banks —
 * the bank decides. Nothing here promises an approval, an account number, or a
 * timeline the bank controls.
 */

export const BANKING_QUICK_FACTS: QuickFact[] = [
  { Icon: GlobeIcon, label: 'US, UK, Canadian & European accounts' },
  { Icon: UserIcon, label: 'Non-resident founders supported' },
  { Icon: CreditCardIcon, label: 'Multi-currency platform partners' },
];

export const BANKING_FEATURES: ServiceFeature[] = [
  {
    Icon: LandmarkIcon,
    title: 'Options Matched to Your Entity',
    description:
      'Not every bank takes every company. We shortlist the partners that accept your entity type, your jurisdiction, and what your business actually does.',
  },
  {
    Icon: FileTextIcon,
    title: 'The Application, Prepared',
    description:
      'Formation documents, tax number, ownership structure, and business description assembled into the file the bank asks for — in the order it asks for it.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Compliance Check First',
    description:
      'We review your documents against the partner’s onboarding requirements before submitting, because a rejected application is harder to fix than a delayed one.',
  },
  {
    Icon: UserIcon,
    title: 'Built for Non-Residents',
    description:
      'Most of the founders we work with have no local residency and no intention of flying in. The routes we use are the ones that work remotely.',
  },
  {
    Icon: GlobeIcon,
    title: 'Multi-Currency Accounts',
    description:
      'Hold and receive in more than one currency where the partner supports it — useful the moment you invoice or sell outside your home market.',
  },
  {
    Icon: BellIcon,
    title: 'Tracked in Your Dashboard',
    description:
      'Where the application is, what the bank has asked for, and what we are waiting on — with a thread to the team handling it.',
  },
];

export const BANKING_STEPS: ServiceStep[] = [
  {
    Icon: BriefcaseIcon,
    title: 'Tell Us About the Company',
    description:
      'The entity, where it is registered, who owns it, what it sells, and which market you want the account in. Order it alongside formation and these answers carry across.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'We Check and Match',
    description:
      'We review your documents against each partner’s onboarding rules and shortlist the ones that accept your profile — rather than sending one application everywhere.',
  },
  {
    Icon: FileTextIcon,
    title: 'Application Submitted',
    description:
      'We assemble and submit the file, then handle the back-and-forth when the bank asks for something further.',
  },
  {
    Icon: LandmarkIcon,
    title: 'The Bank Verifies You',
    description:
      'Every bank runs its own KYC — usually an identity check and a few questions about the business, done online. This part is between you and them; we stay on it with you.',
  },
];

export const BANKING_RELATED: RelatedService[] = [
  {
    Icon: BriefcaseIcon,
    title: 'Company Formation',
    description:
      'Banks ask for formation documents and a tax number before they open anything. If the company does not exist yet, this is the first order.',
    to: '/services/formation',
    linkLabel: 'View formation details',
  },
  {
    Icon: MailOpenIcon,
    title: 'Virtual Mail Room',
    description:
      'Cards, security devices, and account letters arrive by post. A real business address is also what the application form wants.',
    to: '/services/mailroom',
    linkLabel: 'View mail room details',
  },
  {
    Icon: ShoppingCartIcon,
    title: 'E-Commerce Account Setup',
    description:
      'Marketplaces pay into a business account in the company’s name. Set both up together and the details match when they are checked.',
    to: '/services/ecommerce',
    linkLabel: 'View e-commerce details',
  },
];

export const BANKING_FAQS: Faq[] = [
  {
    question: 'Can a non-resident open a US or UK business account?',
    answer:
      'Yes. Our partnerships with remote banking platforms let global founders open corporate accounts online without visiting the country. What you cannot do is skip the verification — every partner runs an identity and business check before it opens anything.',
  },
  {
    question: 'Do I need to form a company first?',
    answer:
      'Yes. Banks require official formation documents and a tax number, such as an EIN, before they can legally open a business account. If the company does not exist yet, order formation and banking together — the details you give once carry into both.',
  },
  {
    question: 'Can you guarantee my account will be approved?',
    answer:
      'No, and be careful with anyone who says otherwise. The bank makes that decision under its own compliance rules. What we control is the quality of the application — matched to partners that accept your profile, checked before it goes in, and pursued while it is open.',
  },
  {
    question: 'How long does it take?',
    answer:
      'It depends on the partner and on how quickly the verification steps are completed at your end. We can tell you what a given partner is currently taking when we shortlist them, but the timeline belongs to the bank, not to us.',
  },
  {
    question: 'What documents will I need?',
    answer:
      'Formation documents, your tax number, identification and proof of address for each owner and director, and a plain description of what the business does and where its money will come from. Anything specific to a partner, we will ask for before submitting.',
  },
  {
    question: 'What if my application is declined?',
    answer:
      'It happens, usually over a business model or a jurisdiction a particular bank will not take. We tell you the reason where the bank gives one, and where another partner on the shortlist fits your profile we go to them next.',
  },
  {
    question: 'Do you hold my money or see my account?',
    answer:
      'No. The account is opened in your company’s name, with the bank, and the credentials go to you. Marty Global is not a bank, does not hold or move your funds, and has no access to the account once it is open.',
  },
  {
    question: 'What does the service cost?',
    answer:
      'It is priced per application, and it varies with the market and the partner. Submit the application and you get an itemised quote in your dashboard before any work starts — with nothing to pay until you accept it. Any fee the bank itself charges is the bank’s, and separate.',
  },
];
