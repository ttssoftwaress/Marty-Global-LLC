import type { Faq } from '../../shared/FaqSection';
import {
  BellIcon,
  BriefcaseIcon,
  BuildingIcon,
  CheckIcon,
  FileTextIcon,
  LandmarkIcon,
  MailOpenIcon,
  MapPinIcon,
  PiggyBankIcon,
  ScanLineIcon,
  ShieldCheckIcon,
} from '../../icons';
import { US_STATE_COUNT } from '../coverage';
import type { QuickFact } from '../detail/ServiceDetailHero';
import type { ServiceFeature } from '../detail/ServiceFeatureGrid';
import type { RelatedService } from '../detail/ServiceRelatedSection';
import type { ServiceStep } from '../detail/ServiceStepGrid';

/*
 * Copy for `/services/registered-agent`. The page composes the shared detail
 * sections (`services/detail/`) from this file plus its one service-specific
 * section — what the appointment actually does and what lapses if nobody holds
 * it.
 *
 * The capabilities described here are the ones the service carries in the
 * catalog (`backend/prisma/seed-catalog.ts`, `registered-agent`): the address on
 * the public record, same-day scanning of legal notices, renewal reminders, and
 * the three follow-up requests a customer can raise against a live appointment —
 * renew, change the registered address, and a certificate of good standing.
 */

export const AGENT_QUICK_FACTS: QuickFact[] = [
  { Icon: LandmarkIcon, label: `${US_STATE_COUNT} US states, DC & territories` },
  { Icon: ShieldCheckIcon, label: 'One year included with US formation' },
  { Icon: ScanLineIcon, label: 'Legal notices scanned same day' },
];

export const AGENT_FEATURES: ServiceFeature[] = [
  {
    Icon: MapPinIcon,
    title: 'Your Address on the Public Record',
    description:
      'Our address goes on the state filing instead of yours. The register is public, so this is the one place where using your home address is hardest to undo.',
  },
  {
    Icon: ScanLineIcon,
    title: 'Same-Day Scanning of Legal Notices',
    description:
      'Service of process and state correspondence is scanned and filed to your dashboard the day it is received — these are the letters with a deadline attached.',
  },
  {
    Icon: BellIcon,
    title: 'Renewal Reminders',
    description:
      'The appointment is annual. We remind you before it lapses, and your dashboard shows each appointment’s renewal date rather than leaving you to diary it.',
  },
  {
    Icon: BuildingIcon,
    title: 'Change Address Without Re-Filing Alone',
    description:
      'Move an appointment to another of our locations from your dashboard, and we file the change with the state for you.',
  },
  {
    Icon: FileTextIcon,
    title: 'Certificate of Good Standing',
    description:
      'Request proof from the registry that the company is current — banks and marketplaces ask for it, and it is a request against the appointment you already hold.',
  },
  {
    Icon: CheckIcon,
    title: 'Included With Every US Formation',
    description:
      'Form a company with us and the first year is part of the order. Already formed elsewhere? Appoint us on its own and we file the change.',
  },
];

export const AGENT_STEPS: ServiceStep[] = [
  {
    Icon: BriefcaseIcon,
    title: 'Tell Us the Company',
    description:
      'Its name, the state or country it is registered in, and its registration number — or none, if we are forming it in the same application.',
  },
  {
    Icon: FileTextIcon,
    title: 'We File the Appointment',
    description:
      'We prepare the consent and file it with the registry, whether that is a new appointment or a change from your current agent.',
  },
  {
    Icon: MailOpenIcon,
    title: 'Notices Come to Us',
    description:
      'Anything the state serves on the company arrives at our address, gets scanned the same day, and lands in your dashboard with a notification.',
  },
  {
    Icon: BellIcon,
    title: 'We Keep It Current',
    description:
      'You get a reminder before the annual renewal, and the appointment record in your dashboard shows its status and renewal date year after year.',
  },
];

export const AGENT_RELATED: RelatedService[] = [
  {
    Icon: BriefcaseIcon,
    title: 'Company Formation',
    description:
      'Form the LLC, INC, or LTD the appointment attaches to — the first year of agent service is part of every US formation order.',
    to: '/services/formation',
    linkLabel: 'View formation details',
  },
  {
    Icon: MailOpenIcon,
    title: 'Virtual Mail Room',
    description:
      'The agent address takes state notices only. Ordinary business post needs an address of its own, scanned and forwarded the same way.',
    to: '/services/mailroom',
    linkLabel: 'View mail room details',
  },
  {
    Icon: PiggyBankIcon,
    title: 'Bank Account Opening',
    description:
      'Banks check that the company is in good standing before they open an account — which is exactly what a live appointment keeps it in.',
    to: '/services/banking',
    linkLabel: 'View banking details',
  },
];

export const AGENT_FAQS: Faq[] = [
  {
    question: 'What is a Registered Agent?',
    answer:
      'The person or company a state has on file to receive legal documents and official notices for your business — service of process, tax notices, annual report reminders. US states require every registered entity to have one with a physical address in the state of registration.',
  },
  {
    question: 'Can I be my own Registered Agent?',
    answer:
      'In most states an individual with a physical in-state address available during business hours can be. Two things stop founders doing it: the address becomes public record, and the appointment has to be staffed during business hours — which is a problem if you are in another time zone or travelling.',
  },
  {
    question: 'Is it included with company formation?',
    answer:
      'Yes — one year of Registered Agent service comes with every US formation, in every state we hold an address in. After that first year it renews annually, and you will get a reminder before it does.',
  },
  {
    question: 'I already have a company. Can I switch to you?',
    answer:
      'Yes. Order the service on its own, give us the company and where it is registered, and we prepare and file the change of agent with the registry.',
  },
  {
    question: 'What happens if my appointment lapses?',
    answer:
      'A state that cannot reach your agent can put the company out of good standing, and in time move to dissolve it administratively. That is why the renewal date is on the record in your dashboard and why we remind you before it arrives.',
  },
  {
    question: 'Is a Registered Agent the same as a business address?',
    answer:
      'No. The agent address receives state notices and legal service. Bank letters, platform verification post, customer mail, and packages need the Virtual Mail Room — most founders end up with both.',
  },
  {
    question: 'What does Registered Agent service cost?',
    answer:
      'It is an annual appointment priced by the state or country it is filed in. Submit the application and you get an itemised quote in your dashboard before any filing happens — and nothing to pay until you accept it.',
  },
];
