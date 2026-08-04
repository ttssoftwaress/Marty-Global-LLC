import type { Faq } from '../../shared/FaqSection';
import {
  BriefcaseIcon,
  ClockIcon,
  FileTextIcon,
  GlobeIcon,
  MailOpenIcon,
  MonitorIcon,
  PaletteIcon,
  ServerIcon,
  ShoppingCartIcon,
  ZapIcon,
} from '../../icons';
import type { QuickFact } from '../detail/ServiceDetailHero';
import type { ServiceFeature } from '../detail/ServiceFeatureGrid';
import type { RelatedService } from '../detail/ServiceRelatedSection';
import type { ServiceRequest } from '../detail/ServiceRequestGrid';
import type { ServiceStep } from '../detail/ServiceStepGrid';

/*
 * Copy for `/services/website`.
 *
 * Grounded in the catalog entry (`seed-catalog.ts`, `website`) and its field
 * registry: five site types, the platforms scoped to each, page-count bands,
 * the domain options (own / register / transfer / undecided), who writes the
 * content, brand assets, delivery in 2–4 weeks, and the three follow-up requests
 * a launched site accepts. The order form is the contract — if its options
 * change, this file changes with them.
 */

export const WEBSITE_QUICK_FACTS: QuickFact[] = [
  { Icon: PaletteIcon, label: 'Designed, built & launched for you' },
  { Icon: GlobeIcon, label: 'Domain, hosting & SSL handled' },
  { Icon: ClockIcon, label: 'Delivered in 2 to 4 weeks' },
];

export const WEBSITE_FEATURES: ServiceFeature[] = [
  {
    Icon: PaletteIcon,
    title: 'Designed Around Your Brand',
    description:
      'Send us the logo, fonts, and colours you already have and the site is built to them. Nothing you own gets redrawn because it was easier to start over.',
  },
  {
    Icon: GlobeIcon,
    title: 'The Domain, Handled',
    description:
      'Already own it, want a new one registered, or want it moved to us — all three are options on the form, and we do the part that involves DNS.',
  },
  {
    Icon: ServerIcon,
    title: 'Hosting and SSL Included',
    description:
      'The site is hosted, secured with SSL, and kept up. The renewal date sits on the site’s record in your dashboard rather than in an email you archived.',
  },
  {
    Icon: FileTextIcon,
    title: 'Content Written, or Yours',
    description:
      'Provide the text and images, have us write and source them, or hand over what you have and we fill the gaps. Say which on the brief.',
  },
  {
    Icon: MonitorIcon,
    title: 'Built on the Right Platform',
    description:
      'Shopify or WooCommerce for a store, WordPress or Webflow for a business site, a custom Next.js or Laravel build for an application — or tell us to recommend one.',
  },
  {
    Icon: ZapIcon,
    title: 'Changes After Launch',
    description:
      'Content updates, new features, and renewals are requests you raise from the site’s record, each with a stated turnaround.',
  },
];

export const WEBSITE_STEPS: ServiceStep[] = [
  {
    Icon: BriefcaseIcon,
    title: 'The Brief',
    description:
      'What kind of site, which platform (or ask us to recommend one), roughly how many pages, the features you need, and a few sites you like.',
  },
  {
    Icon: GlobeIcon,
    title: 'Domain & Content',
    description:
      'Whether you own a domain or want one registered or transferred, who is writing the content, and any logo or brand assets you already have.',
  },
  {
    Icon: PaletteIcon,
    title: 'Design & Build',
    description:
      'We design it, build it on the agreed platform, and put it in front of you before anything goes live — normally over two to four weeks.',
  },
  {
    Icon: ZapIcon,
    title: 'Launch',
    description:
      'The site goes live on your domain with hosting and SSL in place. Its address, admin link, and hosting renewal date all land on its record in your dashboard.',
  },
];

// The three follow-up requests a launched site accepts, with the turnarounds
// the catalog states for each.
export const WEBSITE_REQUESTS: ServiceRequest[] = [
  {
    Icon: FileTextIcon,
    label: 'Request a content update',
    description: 'Text, images, or prices that need changing.',
    turnaround: 'Typically 2–3 business days',
  },
  {
    Icon: ZapIcon,
    label: 'Add a feature',
    description: 'Something the site does not do yet — described in your words.',
    turnaround: 'Quoted within 2 business days',
  },
  {
    Icon: ServerIcon,
    label: 'Renew hosting & domain',
    description: 'Extend hosting, SSL, and the domain registration.',
    turnaround: 'Applied the same day',
  },
];

export const WEBSITE_RELATED: RelatedService[] = [
  {
    Icon: BriefcaseIcon,
    title: 'Company Formation',
    description:
      'The registered entity whose name goes in the footer, on the invoices, and on the terms the site publishes.',
    to: '/services/formation',
    linkLabel: 'View formation details',
  },
  {
    Icon: ShoppingCartIcon,
    title: 'E-Commerce Account Setup',
    description:
      'Selling on marketplaces as well as your own store? They verify your site against what you told them.',
    to: '/services/ecommerce',
    linkLabel: 'View e-commerce details',
  },
  {
    Icon: MailOpenIcon,
    title: 'Virtual Mail Room',
    description:
      'A real business address for the contact page — one you can publish without giving out where you live.',
    to: '/services/mailroom',
    linkLabel: 'View mail room details',
  },
];

export const WEBSITE_FAQS: Faq[] = [
  {
    question: 'How long does a site take?',
    answer:
      'Two to four weeks in the normal case, measured from the point the brief and the content are settled. A single landing page lands at the fast end; a fifteen-page site where we are also writing the copy lands at the slow end.',
  },
  {
    question: 'What kinds of site do you build?',
    answer:
      'Business and brochure sites, online stores, single landing pages, blogs and publications, and custom web applications. The order form asks which one first, because it decides everything after it.',
  },
  {
    question: 'Which platform will it be built on?',
    answer:
      'Shopify or WooCommerce for a store, WordPress or Webflow for a business site or landing page, Framer for a landing page, Ghost for a publication, and a custom Next.js or Laravel build for an application. If you have no preference, choose "recommend one for me" and we will advise.',
  },
  {
    question: 'Do I need to have a domain already?',
    answer:
      'No. Tell us whether you own one, want a new one registered, want an existing one transferred to us, or have not decided — all four are answers on the form, and we handle the DNS either way.',
  },
  {
    question: 'Who writes the content?',
    answer:
      'Your choice. Provide the text and images yourself, have us write and source them, or give us what you have and we fill the gaps. Content is usually what decides whether a site takes two weeks or four.',
  },
  {
    question: 'Is hosting included?',
    answer:
      'Yes — hosting and SSL come with the build, and the renewal date is on the site’s record in your dashboard. Renewing is a same-day request from that record.',
  },
  {
    question: 'Can I change things after it launches?',
    answer:
      'Yes. Content updates are typically 2 to 3 business days. Something the site does not do yet is a feature request, and you get a quote for it within 2 business days before any work starts.',
  },
  {
    question: 'Do I own the site?',
    answer:
      'Yes. It is your domain, your brand, and your content, and the site’s live address and admin link are on your record from the day it launches.',
  },
  {
    question: 'What does a website cost?',
    answer:
      'It depends on the kind of site, how many pages it has, the features you need, and whether we write the content. You submit the brief, we review it, and you get an itemised quote in your dashboard before any design work starts — with nothing to pay until you accept it.',
  },
];
