import { HowItWorksCountryVarianceSection } from '../components/how-it-works/HowItWorksCountryVarianceSection';
import { HowItWorksDashboardSection } from '../components/how-it-works/HowItWorksDashboardSection';
import { HowItWorksHeroSection } from '../components/how-it-works/HowItWorksHeroSection';
import { HowItWorksStatsSection } from '../components/how-it-works/HowItWorksStatsSection';
import { HowItWorksTimelineSection } from '../components/how-it-works/HowItWorksTimelineSection';
import { FaqSection, type Faq } from '../components/shared/FaqSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

const HOW_IT_WORKS_FAQS: Faq[] = [
  {
    question: 'Can I order multiple services at once?',
    answer:
      'Yes. You can select and order as many services as you need from your Dashboard in a single session.',
  },
  {
    question: 'What happens if my application is missing information?',
    answer:
      'Our team will flag the issue and notify you through your Dashboard and email. You can upload corrections directly.',
  },
  {
    question: 'How do I pay?',
    answer:
      'After your application is reviewed, you will receive a tailored quote and a secure payment link. We accept major credit cards and bank transfers.',
  },
];

/*
 * How It Works — marketing page (`/how-it-works`). Built section by section; the
 * hero leads. Navbar and Footer are the shared marketing chrome.
 */

export function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="How It Works — Marty Global LLC"
        description="See how Marty Global LLC takes you from application to active company: submit your details, we file and verify, then manage everything from one dashboard."
        path="/how-it-works"
      />
      <Navbar />
      <main className="flex-1">
        <HowItWorksHeroSection />
        <HowItWorksTimelineSection />
        <HowItWorksDashboardSection />
        <HowItWorksCountryVarianceSection />
        <HowItWorksStatsSection />
        <FaqSection
          subheading="Clear, helpful context regarding Marty Global LLC's process."
          faqs={HOW_IT_WORKS_FAQS}
        />
      </main>
      <Footer />
    </div>
  );
}
