import type { Faq } from '../../shared/FaqSection';
import {
  BellIcon,
  BuildingIcon,
  CheckIcon,
  CreditCardIcon,
  FileTextIcon,
  GlobeIcon,
  MailIcon,
  MailOpenIcon,
  PiggyBankIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
} from '../../icons';
import { US_STATE_COUNT } from '../coverage';
import type { QuickFact } from '../detail/ServiceDetailHero';
import type { ServiceFeature } from '../detail/ServiceFeatureGrid';
import type { RelatedService } from '../detail/ServiceRelatedSection';
import type { ServiceStep } from '../detail/ServiceStepGrid';

/*
 * Copy for `/services/formation`. The page composes the shared detail sections
 * (`services/detail/`) from this file plus its two service-specific sections —
 * the entity types and the jurisdiction cards. Keeping the words here is what
 * makes a new service page a content file rather than a set of new components.
 */

export const FORMATION_QUICK_FACTS: QuickFact[] = [
  { Icon: GlobeIcon, label: `${US_STATE_COUNT} US states & 11 more countries` },
  { Icon: ShieldCheckIcon, label: 'Registered Agent included (US)' },
  { Icon: CheckIcon, label: 'EIN / Tax ID application support' },
];

export const FORMATION_FEATURES: ServiceFeature[] = [
  {
    Icon: BuildingIcon,
    title: 'Entity Registration & Filing',
    description:
      'Name check, forms prepared, and the filing submitted to the state or national registry that issues your entity.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Registered Agent — One Year',
    description:
      'US states require an agent on standby during business hours to receive official notices. One year is included with every US formation.',
  },
  {
    Icon: FileTextIcon,
    title: 'Corporate Documents',
    description:
      'Operating agreement or bylaws, the registry certificate, and the standard formation set — delivered as files, not paper you have to chase.',
  },
  {
    Icon: TrendingUpIcon,
    title: 'EIN / Tax ID Support',
    description:
      'Guided application for your federal tax number, including the non-resident route where you have no SSN or ITIN.',
  },
  {
    Icon: MailOpenIcon,
    title: 'Everything in Your Dashboard',
    description:
      'Each document lands in your Documents library the moment it is issued, linked to the order it came from.',
  },
  {
    Icon: BellIcon,
    title: 'Progress You Can See',
    description:
      'Status updates as the filing moves, with email notifications at each step, and a thread with the team on the order itself.',
  },
];

export const FORMATION_STEPS: ServiceStep[] = [
  {
    Icon: BuildingIcon,
    title: 'Choose Entity & Jurisdiction',
    description:
      'Pick the structure and the country or state you want it registered in. Order formation on its own or alongside a mail room and banking support.',
  },
  {
    Icon: MailIcon,
    title: 'Submit Your Application',
    description:
      'Answer the questions for your jurisdiction and upload the identity and address documents that registry requires.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'We Review It',
    description:
      'Our team checks the submission for completeness before anything reaches a registry, and flags anything that would come back rejected.',
  },
  {
    Icon: CreditCardIcon,
    title: 'Quote & Payment',
    description:
      'You receive an itemised quote in your dashboard covering our fee and that jurisdiction’s government fees. Filing starts once it is settled.',
  },
  {
    Icon: FileTextIcon,
    title: 'Filed & Delivered',
    description:
      'We file with the registry and deliver the certificate, corporate documents, and tax number to your dashboard as each one is issued.',
  },
];

export const FORMATION_RELATED: RelatedService[] = [
  {
    Icon: MailOpenIcon,
    title: 'Virtual Mail Room',
    description:
      'A real business street address in your jurisdiction, with incoming mail scanned to your dashboard and forwarded worldwide.',
    to: '/services/mailroom',
    linkLabel: 'View mail room details',
  },
  {
    Icon: PiggyBankIcon,
    title: 'Bank Account Opening',
    description:
      'Guided applications with partner banks for the entity we just formed — including the non-resident route.',
    to: '/services/banking',
    linkLabel: 'View banking details',
  },
  /*
   * The agent rather than e-commerce, which is the more distant sibling: the
   * first year of agent service is inside this order, so the question it raises
   * ("what is that, and what happens in year two?") belongs on this page.
   */
  {
    Icon: ShieldCheckIcon,
    title: 'Registered Agent',
    description:
      'The state contact your filing must name — included for a year here, and renewable on its own after that.',
    to: '/services/registered-agent',
    linkLabel: 'View agent details',
  },
];

// The questions a visitor asks on this page. The answers match the copy used
// elsewhere on the site so two pages cannot disagree.
export const FORMATION_FAQS: Faq[] = [
  {
    question: 'How long does company formation take?',
    answer:
      'Typically 3 to 7 business days depending on state or jurisdiction processing speeds. Delaware and Wyoming usually settle fast, the UK is often quicker, and European filings that need notarised deeds take longest.',
  },
  {
    question: 'Can I form a company if I do not live in the country?',
    answer:
      'Yes. Most of the founders we file for are non-residents. You do not need to travel, and you do not need local residency to own a US LLC or a UK LTD — you do need identity and address documents from wherever you actually live.',
  },
  {
    question: 'Which state should I register my LLC in?',
    answer:
      `Delaware and Wyoming are the states non-residents ask for most often. We file in ${US_STATE_COUNT} states today, plus DC, Guam, and Puerto Rico — the full list is on this page. Which one fits your business is your decision: we are a filing service provider, not a law firm, and we do not give legal or tax advice.`,
  },
  {
    question: 'Do I get an EIN or tax number with my formation?',
    answer:
      'We support the application as part of the order, including the non-resident route where you have no SSN or ITIN. The number itself is issued by the tax authority, so the timing is theirs, not ours.',
  },
  {
    question: 'Is Registered Agent service included?',
    answer:
      'Yes — one year of Registered Agent service is included with every US formation, in every state we hold an address in. US states require an agent available during business hours to receive official notices on the company’s behalf.',
  },
  {
    question: 'Do I need a business address as well?',
    answer:
      'A Registered Agent address is not a business address. If you want mail your customers, banks, and platforms can send to — received, scanned, and forwarded — that is the Virtual Mail Room, and it can be ordered alongside your formation.',
  },
  {
    question: 'What does formation cost?',
    answer:
      'It depends on the jurisdiction, because each registry charges its own government fee. You submit the application, we review it, and you receive an itemised quote in your dashboard covering our fee and those government fees. Nothing is charged before you accept it.',
  },
];
