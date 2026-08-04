import type { Faq } from '../../shared/FaqSection';
import {
  BriefcaseIcon,
  ClockIcon,
  CpuIcon,
  DownloadIcon,
  GlobeIcon,
  KeyIcon,
  MailOpenIcon,
  MonitorIcon,
  ServerIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '../../icons';
import type { QuickFact } from '../detail/ServiceDetailHero';
import type { ServiceFeature } from '../detail/ServiceFeatureGrid';
import type { RelatedService } from '../detail/ServiceRelatedSection';
import type { ServiceRequest } from '../detail/ServiceRequestGrid';
import type { ServiceStep } from '../detail/ServiceStepGrid';

/*
 * Copy for `/services/remote-desktop`.
 *
 * This one has a catalog entry behind it, so the page states exactly what the
 * order form asks for and delivers (`seed-catalog.ts`, `remote-desktop`, and the
 * `rdp_*` field registry): four plans, four operating systems, six data centres,
 * simultaneous-user tiers, monthly / quarterly / annual terms, ready within 24
 * hours, and the four follow-up requests a live server accepts. If the catalog
 * options change, this file changes with them — a marketing page offering a data
 * centre the form does not list is a support ticket waiting to happen.
 */

export const RDP_QUICK_FACTS: QuickFact[] = [
  { Icon: CpuIcon, label: 'Dedicated vCPU, RAM & SSD — never shared' },
  { Icon: GlobeIcon, label: 'Six data centres across the US, UK, EU & Asia' },
  { Icon: ClockIcon, label: 'Set up and handed over within 24 hours' },
];

export const RDP_FEATURES: ServiceFeature[] = [
  {
    Icon: CpuIcon,
    title: 'Resources That Are Yours',
    description:
      'Dedicated vCPU, RAM, and SSD — not a slice of a machine you share with strangers whose workload becomes your slowdown.',
  },
  {
    Icon: MonitorIcon,
    title: 'Windows or Linux',
    description:
      'Windows Server 2022 or 2019, Windows 11 Pro, or Ubuntu Desktop 24.04 — installed and ready before you get the credentials.',
  },
  {
    Icon: GlobeIcon,
    title: 'Six Data Centres',
    description:
      'US East (Virginia), US West (Oregon), London, Amsterdam, Frankfurt, or Singapore. Pick the one nearest where you actually work.',
  },
  {
    Icon: UsersIcon,
    title: 'One Person or a Whole Team',
    description:
      'Sized by how many people are logged in at once, from a single user to more than ten — so a shared machine stays usable at 3pm.',
  },
  {
    Icon: DownloadIcon,
    title: 'Software Pre-Installed',
    description:
      'Tell us what you need on it — a browser, an office suite, a specific terminal — and it is installed and configured before handover.',
  },
  {
    Icon: ServerIcon,
    title: 'Managed After Handover',
    description:
      'Password resets, upgrades, renewals, and new software are requests you raise from your dashboard, not tickets into a void.',
  },
];

export const RDP_STEPS: ServiceStep[] = [
  {
    Icon: MonitorIcon,
    title: 'Choose the Machine',
    description:
      'Plan, operating system, data centre, how many people will use it at once, and whether you want to pay monthly, quarterly, or annually.',
  },
  {
    Icon: ServerIcon,
    title: 'We Build It',
    description:
      'The server is provisioned in the data centre you picked, your operating system installed, and any software you asked for set up on it.',
  },
  {
    Icon: DownloadIcon,
    title: 'Credentials in Your Dashboard',
    description:
      'Hostname, IP, username, and a ready-made connection file land on the server’s record in your dashboard, usually within 24 hours.',
  },
  {
    Icon: BriefcaseIcon,
    title: 'Work From Anywhere',
    description:
      'Sign in from a laptop, a desktop, or a tablet. The machine stays on when your device is off, and its renewal date is on the record.',
  },
];

// The four follow-up requests a live server accepts, with the turnarounds the
// catalog states for each.
export const RDP_REQUESTS: ServiceRequest[] = [
  {
    Icon: KeyIcon,
    label: 'Reset my password',
    description: 'We set a new password and get it to you securely.',
    turnaround: 'Usually within a few hours',
  },
  {
    Icon: CpuIcon,
    label: 'Upgrade the server',
    description: 'More vCPU, RAM, or disk on the same machine — no rebuild.',
    turnaround: 'Typically 1 business day',
  },
  {
    Icon: ClockIcon,
    label: 'Renew the server',
    description: 'Extend the subscription before the expiry date on its record.',
    turnaround: 'Applied the same day',
  },
  {
    Icon: DownloadIcon,
    label: 'Install software',
    description: 'We install and configure what you need on the machine.',
    turnaround: 'Typically 1–2 business days',
  },
];

export const RDP_RELATED: RelatedService[] = [
  {
    Icon: BriefcaseIcon,
    title: 'Company Formation',
    description:
      'The entity behind the operation — LLC, INC, or LTD, filed with the registry and delivered to the same dashboard.',
    to: '/services/formation',
    linkLabel: 'View formation details',
  },
  {
    Icon: MailOpenIcon,
    title: 'Virtual Mail Room',
    description:
      'A business address in the market you work in, with the post scanned to you and forwarded on request.',
    to: '/services/mailroom',
    linkLabel: 'View mail room details',
  },
  {
    Icon: ShoppingCartIcon,
    title: 'E-Commerce Account Setup',
    description:
      'Seller accounts registered and verified in your company’s name on the marketplaces that require a local entity.',
    to: '/services/ecommerce',
    linkLabel: 'View e-commerce details',
  },
];

export const RDP_FAQS: Faq[] = [
  {
    question: 'What exactly do I get?',
    answer:
      'A dedicated Windows or Linux desktop running in a data centre, online around the clock. You connect to it over Remote Desktop from any device you sign in from, and it keeps running whether or not your own machine is on.',
  },
  {
    question: 'Is the machine shared with anyone else?',
    answer:
      'No. The vCPU, RAM, and SSD on your plan are yours. Sharing is the reason cheap remote desktops stall at the worst moment, and it is the thing this service is specified against.',
  },
  {
    question: 'How long until it is ready?',
    answer:
      'Set up and handed over within 24 hours in the normal case. The credentials and a connection file appear on the server’s record in your dashboard when it is done.',
  },
  {
    question: 'Which operating systems can I have?',
    answer:
      'Windows Server 2022, Windows Server 2019, Windows 11 Pro, or Ubuntu Desktop 24.04. Pick it on the order form and we install it before handover.',
  },
  {
    question: 'Can several people use it at the same time?',
    answer:
      'Yes — you tell us how many simultaneous users to size it for, from one to more than ten, and we specify the machine accordingly. Undersizing it is what makes a shared desktop unusable, so be honest about the number.',
  },
  {
    question: 'Can you install my software on it?',
    answer:
      'Yes, for licensed software you own — name it on the order form and it will be installed and configured before you get the machine. Send us the licence keys through a secure channel once the server is ready, never in the order form itself.',
  },
  {
    question: 'What if I need more power later?',
    answer:
      'Raise an upgrade request from the server’s record and we add vCPU, RAM, or disk to the same machine — typically within a business day, without rebuilding it.',
  },
  {
    question: 'What happens if I forget the password?',
    answer:
      'Request a reset from your dashboard. We set a new one and get it to you securely, usually within a few hours. We never send credentials in plain email.',
  },
  {
    question: 'How is it billed?',
    answer:
      'It is a subscription — monthly, quarterly, or annual, whichever you pick — and the server record shows its expiry date. You get an itemised quote in your dashboard before anything is provisioned, and nothing is charged until you accept it.',
  },
];
