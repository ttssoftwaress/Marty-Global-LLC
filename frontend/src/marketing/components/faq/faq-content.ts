import type { Faq } from '../shared/FaqSection';

/*
 * The FAQ page's content. The shared `FaqSection` accordion carries a short,
 * page-specific set on home / services / how-it-works; this is the full library
 * behind `/faq`, grouped so a visitor can jump to the part they came for.
 *
 * Copy is written here rather than fetched — marketing is static pages
 * (AGENTS.md, Frontend). Answers describe process and scope only: Marty Global
 * is a filing service provider, not a law firm, so nothing here reads as legal
 * or tax advice, and no timeline is stated as a guarantee.
 *
 * No prices. Amounts depend on the service, the jurisdiction, and the
 * government fees that apply, and the binding figure is the quote issued in the
 * customer's portal — so the money questions point there instead of naming a
 * number the marketing site would immediately be wrong about.
 */

export type FaqCategory = {
  /** Slug used as the section's DOM id, so `/faq#billing` deep-links. */
  id: string;
  label: string;
  description: string;
  faqs: Faq[];
};

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    label: 'Getting started',
    description: 'What we do, who we work with, and how an order begins.',
    faqs: [
      {
        question: 'What does Marty Global LLC actually do?',
        answer:
          'We are a filing service provider. We prepare and submit the paperwork that forms and maintains your company, arrange a business address and mail handling, and support your applications for banking and e-commerce accounts. We are not a law firm and do not provide legal, tax, or financial advice.',
      },
      {
        question: 'Do I need to live in the country where I am forming a company?',
        answer:
          'No. Most of our clients form companies in jurisdictions they do not live in. Requirements vary by jurisdiction — some ask for a local address or a local agent, which are services we provide — and we tell you what a jurisdiction needs before you order.',
      },
      {
        question: 'How do I start an order?',
        answer:
          'Create an account, choose the services you need, and answer the application questions for each one. Nothing is charged at that point — your answers go to our team for review, and you receive a quote in your portal once we know exactly what your filing requires.',
      },
      {
        question: 'Can I order more than one service at a time?',
        answer:
          'Yes, and most clients do. Formation, a virtual mail room, and banking support are commonly ordered together, which means the documents each one depends on are prepared once rather than three times.',
      },
      {
        question: 'Which jurisdictions do you support?',
        answer:
          'We hold addresses in 46 US states plus DC, Guam, and Puerto Rico, and in eleven more countries — the United Kingdom, Ireland, the Netherlands, Spain, Italy, Austria, Switzerland, Canada, Singapore, Taiwan, and Brazil. Delaware and Wyoming are the most common US choices for founders based outside the country, and the full state-by-state list is on the Services page.',
      },
    ],
  },
  {
    id: 'formation',
    label: 'Company formation',
    description: 'Filing your entity, the documents involved, and what follows.',
    faqs: [
      {
        question: 'How long does formation take?',
        answer:
          'Typically 3 to 7 business days for a US LLC, depending on the state. Timelines depend on government processing, which is outside our control — we file promptly and keep the status visible in your portal, but we do not guarantee a completion date.',
      },
      {
        question: 'What documents do I get once the company is formed?',
        answer:
          'You receive the formation documents the jurisdiction issues — for a US LLC that is the filed Articles of Organization and the state confirmation — along with your operating agreement and tax registration where those are part of your order. Everything lands in your portal as a downloadable file.',
      },
      {
        question: 'Can you obtain an EIN for a non-US founder?',
        answer:
          'Yes. Applicants without a US Social Security Number cannot use the online IRS route, so the application is filed directly with the IRS instead. That path takes longer than the online one, and we keep you updated in the portal while it is in progress.',
      },
      {
        question: 'What is a Registered Agent, and do I need one?',
        answer:
          'A Registered Agent is a physical presence in the state that receives official state notices and compliance mail during business hours. US states require every company to have one, and we can act as yours.',
      },
      {
        question: 'What happens after my company is formed?',
        answer:
          'Your company has ongoing obligations — annual reports, renewals, and registered agent continuity among them. Your portal tracks the records we hold for you, and we notify you ahead of the deadlines that apply to your jurisdiction so nothing lapses unnoticed.',
      },
    ],
  },
  {
    id: 'banking',
    label: 'Banking & payments accounts',
    description: 'Corporate accounts, e-commerce platforms, and what banks ask for.',
    faqs: [
      {
        question: 'Can a non-US resident open a US business bank account?',
        answer:
          'Yes. We work with remote banking platforms that let founders outside the United States open corporate accounts online, without travelling. We prepare and present your application; the bank makes the approval decision, and no provider approves every applicant.',
      },
      {
        question: 'Do I need to form the company before applying for an account?',
        answer:
          'Yes. Banks require the filed formation documents and a tax number, such as an EIN, before they can open a business account. That is why formation and banking are ordered together — the second depends on the first.',
      },
      {
        question: 'How long does e-commerce account approval take?',
        answer:
          'It depends on the marketplace. Amazon commonly verifies within 3 to 5 business days; other platforms can take longer. We assemble the verification documents up front, which is what prevents most of the delays we see.',
      },
      {
        question: 'What if my banking application is declined?',
        answer:
          'Banks and platforms set their own criteria and do not always explain a decision. If yours is declined, our team reviews what we can see and prepares an application with an alternative provider suited to your structure and region.',
      },
    ],
  },
  {
    id: 'mail-room',
    label: 'Virtual Mail Room',
    description: 'Your business address, scanning, and mail forwarding.',
    faqs: [
      {
        question: 'What is included in the Virtual Mail Room?',
        answer:
          'A physical commercial street address, secure scanning of the mail that arrives there, a notification when something new lands, and the option to have physical items forwarded to you.',
      },
      {
        question: 'How does mail reach me if I am overseas?',
        answer:
          'Mail arrives at our facility, is scanned, and appears in your mail room inbox in the portal, where you can read it the same day. If you need the physical item, you request forwarding from the same screen and we ship it on.',
      },
      {
        question: 'Can I use the address on official filings and my website?',
        answer:
          'Yes — it is a real commercial street address, not a PO box, so it is accepted where a business address is required. Whether it also satisfies a specific regulator or platform depends on their rules, so check their requirements before relying on it.',
      },
      {
        question: 'Can one account hold more than one mail room?',
        answer:
          'Yes. Each company or region can have its own room, and all of them appear side by side in your portal under a single login.',
      },
    ],
  },
  {
    id: 'billing',
    label: 'Quotes & payment',
    description: 'How pricing is quoted, and how you settle a quote.',
    faqs: [
      {
        question: 'How much does a service cost?',
        answer:
          'It depends on the service, the jurisdiction, and the government fees that jurisdiction charges — so we quote rather than publish a fixed list. Once we have reviewed your application, an itemised quote appears in your portal showing what our work covers and what is a government fee. That quote is the figure that binds.',
      },
      {
        question: 'Am I charged when I submit an application?',
        answer:
          'No. Submitting costs nothing. You are only asked to pay once you have a quote in front of you and have chosen to accept it, and we begin work after it settles.',
      },
      {
        question: 'How do I pay a quote?',
        answer:
          'From the billing page in your portal, in USDT on the TRC-20 network. You are shown the exact amount and the address to send it to; work begins as soon as the transfer confirms on-chain.',
      },
      {
        question: 'Can I pay by card?',
        answer:
          'Not yet. Card payment is planned and appears in your portal marked as coming soon. Until it is available, USDT (TRC-20) is the payment method.',
      },
      {
        question: 'What happens if I send the wrong amount?',
        answer:
          'Nothing is lost. An underpayment or an overpayment is recorded against your quote as exactly that, and our team contacts you to settle the difference — a transfer that does not match is never quietly written off.',
      },
      {
        question: 'Are government fees included in the quote?',
        answer:
          'Yes, and they are listed separately from our fee so you can see which part of the total is ours and which the jurisdiction sets.',
      },
    ],
  },
  {
    id: 'account-support',
    label: 'Your account & support',
    description: 'Tracking work in progress, your documents, and reaching us.',
    faqs: [
      {
        question: 'How do I track what is happening with my order?',
        answer:
          'Every order has a status and an activity trail in your portal, updated as our team works through it. You also receive notifications — in the portal and by email — when the status changes or we need something from you.',
      },
      {
        question: 'What if my application is missing something?',
        answer:
          'We flag it on the order and notify you, saying exactly what is needed. You upload the correction from the same screen, and the filing resumes from where it stopped.',
      },
      {
        question: 'How is my identity documentation handled?',
        answer:
          'Documents are stored in private encrypted storage and are accessible only to you and the staff working your order. They are never public, and any link to a file expires shortly after it is issued.',
      },
      {
        question: 'How do I reach a person?',
        answer:
          'Live chat is available from any page on this site and from inside your portal, and the contact form reaches the same team. We respond to messages within one business day.',
      },
      {
        question: 'Do you provide legal or tax advice?',
        answer:
          'No. We prepare and file paperwork accurately and explain what a jurisdiction requires, but we are not a law firm or a tax practice, and using our services does not create an attorney–client relationship. For advice on your specific situation, speak to a qualified professional in that jurisdiction.',
      },
    ],
  },
];
