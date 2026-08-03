import type { Faq } from '../../shared/FaqSection';
import {
  BellIcon,
  BriefcaseIcon,
  BuildingIcon,
  EyeIcon,
  GlobeIcon,
  MailOpenIcon,
  MapPinIcon,
  PiggyBankIcon,
  ScanLineIcon,
  ShoppingCartIcon,
  ShredIcon,
  TruckIcon,
} from '../../icons';
import type { QuickFact } from '../detail/ServiceDetailHero';
import type { ServiceFeature } from '../detail/ServiceFeatureGrid';
import type { RelatedService } from '../detail/ServiceRelatedSection';
import type { ServiceStep } from '../detail/ServiceStepGrid';

/*
 * Copy for `/services/mailroom`. The page composes the shared detail sections
 * (`services/detail/`) from this file plus the one section specific to this
 * service — where the address is used, and how it differs from a Registered
 * Agent address.
 *
 * Every capability described here is one the mailroom module actually has:
 * a room with a real address, scans filed into its inbox, the in-browser
 * viewer, forwarding with a carrier and tracking number, shredding, the storage
 * date on each item, and more than one room per account.
 */

export const MAILROOM_QUICK_FACTS: QuickFact[] = [
  { Icon: MapPinIcon, label: 'Real street address, not a PO box' },
  { Icon: ScanLineIcon, label: 'Mail scanned to your dashboard' },
  { Icon: GlobeIcon, label: 'Forwarded anywhere in the world' },
];

export const MAILROOM_STEPS: ServiceStep[] = [
  {
    Icon: MailOpenIcon,
    title: 'Your Post Arrives',
    description:
      'Mail addressed to your room is received and signed for at our facility — letters from registries and banks, and packages from couriers.',
  },
  {
    Icon: ScanLineIcon,
    title: 'We Scan It',
    description:
      'The envelope and its contents are scanned in high resolution and filed into your room’s inbox, with the sender and the date it arrived.',
  },
  {
    Icon: BellIcon,
    title: 'You Are Notified',
    description:
      'A notification goes out as soon as the scan is ready. Open the item in your dashboard, read it page by page, or download the PDF.',
  },
  {
    Icon: TruckIcon,
    title: 'You Decide What Happens',
    description:
      'Keep it filed, have the original forwarded to any address worldwide, or have it securely shredded. Forwarded items come back with a carrier and a tracking number.',
  },
];

export const MAILROOM_FEATURES: ServiceFeature[] = [
  {
    Icon: MapPinIcon,
    title: 'A Real Street Address',
    description:
      'A commercial address in a business district — the kind banks, registries, and marketplaces accept. Not a PO box.',
  },
  {
    Icon: ScanLineIcon,
    title: 'High-Resolution Scanning',
    description:
      'Envelope and contents scanned and filed into your inbox with the sender and the arrival date, so the record stays searchable later.',
  },
  {
    Icon: EyeIcon,
    title: 'Read It in the Browser',
    description:
      'Open a scan page by page in your dashboard or download the whole PDF. Files are served over short-lived private links, never a public URL.',
  },
  {
    Icon: TruckIcon,
    title: 'Worldwide Forwarding',
    description:
      'Ask for any item to be shipped to an address you give us. The carrier and tracking number come back on the item itself.',
  },
  {
    Icon: ShredIcon,
    title: 'Secure Shredding',
    description:
      'Anything you do not want kept is destroyed on request, and each item carries a storage date so nothing sits in a warehouse unnoticed.',
  },
  {
    Icon: BuildingIcon,
    title: 'More Than One Room',
    description:
      'Run an address in each market you operate in. Every room has its own inbox, its own mail, and its own renewal date — all under one login.',
  },
];

export const MAILROOM_RELATED: RelatedService[] = [
  {
    Icon: BriefcaseIcon,
    title: 'Company Formation',
    description:
      'Register the LLC, INC, or LTD the address belongs to — filed with the registry, with corporate documents and EIN support.',
    to: '/services/formation',
    linkLabel: 'View formation details',
  },
  {
    Icon: PiggyBankIcon,
    title: 'Bank Account Opening',
    description:
      'Banks check the address on your application against your formation documents. Order both and the details line up.',
    to: '/services/banking',
    linkLabel: 'View banking details',
  },
  {
    Icon: ShoppingCartIcon,
    title: 'E-Commerce Account Setup',
    description:
      'Amazon, eBay, Walmart, and Alibaba verify a local address before they let you sell. This is the address you give them.',
    to: '/services/ecommerce',
    linkLabel: 'View e-commerce details',
  },
];

export const MAILROOM_FAQS: Faq[] = [
  {
    question: 'Is this a real street address or a PO box?',
    answer:
      'A real commercial street address in a business district. That distinction matters: banks, registries, and marketplaces routinely reject a PO box, and a physical address is what their verification checks look for.',
  },
  {
    question: 'How quickly is my mail scanned?',
    answer:
      'Post is scanned and filed into your room’s inbox after it is received at the facility, and you get a notification the moment the scan is ready. Until then the item shows in your inbox as still scanning, so you always know something arrived.',
  },
  {
    question: 'Can I have the original letter or package sent to me?',
    answer:
      'Yes. Request forwarding on any item and give us the address to ship to. Once our team dispatches it, the carrier and the tracking number appear on that item in your dashboard.',
  },
  {
    question: 'What happens to mail I do not want?',
    answer:
      'Request shredding and it is securely destroyed. Every item also carries a storage date, and your inbox flags anything approaching it so you can forward it in time rather than losing it by default.',
  },
  {
    question: 'Can I use this address to register my company?',
    answer:
      'Where a registry accepts a commercial address for the registered office or business address, yes — and it is the address most of our customers put on the filing. Some jurisdictions have their own rules, so tell us where you are registering and we will confirm before you file.',
  },
  {
    question: 'Is a mail room the same as a Registered Agent?',
    answer:
      'No. A Registered Agent receives official state notices and legal service in the state where you filed, and one year of it is included with every US formation. The mail room receives everything else — bank letters, platform verification post, customer and supplier mail, packages — and scans it to you.',
  },
  {
    question: 'Can I have addresses in more than one country?',
    answer:
      'Yes. Each address is its own room with its own inbox, and they all sit in the same dashboard under one login. Founders selling into several markets commonly run a US and a UK room side by side.',
  },
  {
    question: 'Who can see my mail?',
    answer:
      'Only you and the team member handling your room. Scans live in private storage and are served through short-lived links after an ownership check — there is no public URL to a scan, and nothing is shared with anyone else.',
  },
];
