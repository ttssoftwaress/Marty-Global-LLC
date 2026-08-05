import type { Faq } from '../../shared/FaqSection';
import {
  BellIcon,
  BriefcaseIcon,
  FileTextIcon,
  GlobeIcon,
  LandmarkIcon,
  MailOpenIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  UserIcon,
} from '../../icons';
import type { QuickFact } from '../detail/ServiceDetailHero';
import type { ServiceFeature } from '../detail/ServiceFeatureGrid';
import type { RelatedService } from '../detail/ServiceRelatedSection';
import type { ServiceStep } from '../detail/ServiceStepGrid';

/*
 * Copy for `/services/ecommerce`. The page composes the shared detail sections
 * (`services/detail/`) from this file plus its two service-specific sections —
 * the marketplaces themselves, and what every one of them verifies.
 *
 * Like banking, this service is in the catalog (`e-commerce` in
 * `seed-catalog.ts`) and its outcome belongs to a third party. So the claims
 * stay inside what it delivers — we prepare and submit the seller application
 * and handle the verification — and nothing here promises an approved account
 * or names a platform rule specific enough to go stale. Marketplace names are
 * factual references to where we file, not a claim of partnership or
 * endorsement.
 */

export const ECOMMERCE_QUICK_FACTS: QuickFact[] = [
  { Icon: ShoppingCartIcon, label: 'Amazon, eBay, Walmart & Alibaba' },
  { Icon: ShieldCheckIcon, label: 'Identity & address verification handled' },
  { Icon: GlobeIcon, label: 'Built for cross-border sellers' },
];

export const ECOMMERCE_FEATURES: ServiceFeature[] = [
  {
    Icon: ShoppingCartIcon,
    title: 'Seller Account Registration',
    description:
      'The account opened in your company’s name on the marketplaces you want to sell on, with the registration completed the way each one expects.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Verification, Prepared For',
    description:
      'Identity and address checks are where cross-border sellers stall. We assemble the documents each platform accepts and tell you what the check will ask.',
  },
  {
    Icon: MapPinIcon,
    title: 'Details That Match Everywhere',
    description:
      'Company name, address, and bank account have to agree across the filing, the platform, and the bank. We line them up before anything is submitted.',
  },
  {
    Icon: UserIcon,
    title: 'For Founders Outside the Market',
    description:
      'Selling into a country you do not live in is the case these platforms scrutinise hardest, and the one this service is built around.',
  },
  {
    Icon: FileTextIcon,
    title: 'Compliance Guidance for Your Model',
    description:
      'What a marketplace expects differs by category and by where you sell. We flag what applies to your business before it becomes a suspension.',
  },
  {
    Icon: BellIcon,
    title: 'Tracked in Your Dashboard',
    description:
      'Where each application is, what the platform has asked for, and what we are waiting on — with a thread to the team handling it.',
  },
];

export const ECOMMERCE_STEPS: ServiceStep[] = [
  {
    Icon: BriefcaseIcon,
    title: 'Tell Us Where You Want to Sell',
    description:
      'The marketplaces, the countries, and what you plan to list. Order it with formation and banking and the company details carry across.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'We Check Your Stack',
    description:
      'Entity, address, and bank account reviewed against what that marketplace verifies — because a mismatch between them is the usual reason a seller account is held.',
  },
  {
    Icon: ShoppingCartIcon,
    title: 'Account Registered',
    description:
      'We complete the seller registration in your company’s name and submit the documents each platform asks for at sign-up.',
  },
  {
    Icon: LandmarkIcon,
    title: 'Platform Verification',
    description:
      'The marketplace runs its own identity and business checks, sometimes including a video call or a postcard to your address. We prepare you for it and stay with the application.',
  },
];

export const ECOMMERCE_RELATED: RelatedService[] = [
  {
    Icon: BriefcaseIcon,
    title: 'Company Formation',
    description:
      'Marketplaces that require a local entity mean a registered company with documents to show. That is the order that comes first.',
    to: '/services/formation',
    linkLabel: 'View formation details',
  },
  {
    Icon: MailOpenIcon,
    title: 'Virtual Mail Room',
    description:
      'Address verification is often a physical letter or postcard to the address you gave. This is the address that receives it and scans it to you.',
    to: '/services/mailroom',
    linkLabel: 'View mail room details',
  },
  {
    Icon: LandmarkIcon,
    title: 'Bank Account Opening',
    description:
      'Marketplaces pay out to a business account in the company’s name. Without it there is nowhere for the payout to land.',
    to: '/services/banking',
    linkLabel: 'View banking details',
  },
];

export const ECOMMERCE_FAQS: Faq[] = [
  {
    question: 'How long does marketplace approval take?',
    answer:
      'It depends on the marketplace. Amazon often verifies details in 3 to 5 business days; others can take longer, particularly where a physical address check is part of it. Preparing the documents properly is what avoids the second and third round of requests.',
  },
  {
    question: 'Do I need a company to sell on these platforms?',
    answer:
      'For the accounts we set up, yes. These are business seller accounts on marketplaces that require a properly registered entity in the market you are selling into — which is why formation, address, and banking sit behind this service.',
  },
  {
    question: 'Can you guarantee my seller account is approved?',
    answer:
      'No. The marketplace decides, under its own rules, and those rules change. What we control is the application: the right entity, an address and bank account that match it, and the documents each platform accepts.',
  },
  {
    question: 'Why do my company, address, and bank details have to match?',
    answer:
      'Because the platform checks them against each other. A company registered at one address, a bank account under a slightly different name, and a seller profile with a third set of details is the most common reason a new account is held for review.',
  },
  {
    question: 'Do I need a local address to sell in another country?',
    answer:
      'Usually. Marketplaces verify a business address in the market you are selling into, and often confirm it by sending something to it. A Virtual Mail Room address receives that letter and scans it to your dashboard the day it arrives.',
  },
  {
    question: 'Can you fix a suspended or rejected seller account?',
    answer:
      'That is a separate problem from setting one up, and it depends entirely on why the platform acted. Tell us what happened through your dashboard and we will say plainly whether it is something we can help with.',
  },
  {
    question: 'Do you run the store or handle my listings?',
    answer:
      'No. We get the account registered and verified in your company’s name — the credentials are yours. Listing products, pricing, fulfilment, and customer service are yours to run.',
  },
  {
    question: 'What does the service cost?',
    answer:
      'It is priced per application and varies with the marketplace and the market. Submit the application and you get an itemised quote in your dashboard before any work starts, with nothing to pay until you accept it. Any fee the marketplace charges is its own, and separate.',
  },
];
