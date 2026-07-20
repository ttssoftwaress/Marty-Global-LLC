import { JurisdictionsStripSection } from '../components/services/JurisdictionsStripSection';
import { ServicesGridSection } from '../components/services/ServicesGridSection';
import { ServicesHeroSection } from '../components/services/ServicesHeroSection';
import { WhyChooseUsSection } from '../components/services/WhyChooseUsSection';
import { FaqSection, type Faq } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';
import { TestimonialsSection } from '../components/shared/TestimonialsSection';

/*
 * Services — marketing page (`/services`). Built section by section; the hero
 * leads, the service grid follows, then the jurisdictions strip and the "why
 * one partner" value props. Navbar and Footer are the shared marketing chrome.
 */

// Service-specific FAQ copy — the shared FaqSection defaults to the home page's
// general questions; this page asks about bundling, banking, and mail routing.
const SERVICES_FAQS: Faq[] = [
  {
    question: 'Can I bundle multiple services together?',
    answer:
      'Yes. In fact, most of our clients bundle company formation, Virtual Mail Room, and banking together. This ensures a fully integrated business stack that gets verified much faster.',
  },
  {
    question: 'Do I need to form a company before opening a bank account?',
    answer:
      'Yes. Banks require official corporate formation deeds and a federal tax number (such as an EIN) before they can legally open a business checking account.',
  },
  {
    question: 'Which jurisdictions do you support for LLC and LTD formation?',
    answer:
      'We support legal entity filing in all 50 US states (Delaware and Wyoming are most popular for non-residents), as well as UK, Canada, and EEA European Union jurisdictions.',
  },
  {
    question: 'How does the Virtual Mail Room work for international clients?',
    answer:
      'Once you secure an address, all incoming mail is received at our physical facilities, securely scanned, and instantly uploaded to your digital mail dashboard for online reading.',
  },
  {
    question: 'How long does e-commerce account approval take?',
    answer:
      'Approval times depend on the marketplace. While Amazon often verifies details in 3 to 5 business days, other platforms might take slightly longer. We prepare all verified docs to prevent delays.',
  },
  {
    question: 'What if I need services in multiple countries?',
    answer:
      'Our global networks enable you to register and run multiple regional subsidiaries. You can manage everything through your central Marty Global account.',
  },
];

export function ServicesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Services — Marty Global LLC"
        description="Company formation, virtual mail room, banking support, and e-commerce account setup across US states, the UK, Canada, and the EU — handled by one filing partner."
        path="/services"
      />
      <Navbar />
      <main className="flex-1">
        <ServicesHeroSection />
        <ServicesGridSection />
        <WhyChooseUsSection />
        <JurisdictionsStripSection />
        <TestimonialsSection />
        <FaqSection faqs={SERVICES_FAQS} />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
