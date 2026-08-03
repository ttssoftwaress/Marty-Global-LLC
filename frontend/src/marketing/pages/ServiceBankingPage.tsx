import { BankingRequirementsSection } from '../components/services/banking/BankingRequirementsSection';
import { BankingScopeSection } from '../components/services/banking/BankingScopeSection';
import {
  BANKING_FAQS,
  BANKING_FEATURES,
  BANKING_QUICK_FACTS,
  BANKING_RELATED,
  BANKING_STEPS,
} from '../components/services/banking/banking-content';
import { ServiceDetailHero } from '../components/services/detail/ServiceDetailHero';
import { ServiceFeatureGrid } from '../components/services/detail/ServiceFeatureGrid';
import { ServiceQuoteBand } from '../components/services/detail/ServiceQuoteBand';
import { ServiceRelatedSection } from '../components/services/detail/ServiceRelatedSection';
import { ServiceStepGrid } from '../components/services/detail/ServiceStepGrid';
import { JurisdictionsStripSection } from '../components/services/JurisdictionsStripSection';
import { FaqSection } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * Bank Account Opening — a service detail page (`/services/banking`), reached
 * from the Services grid's "View Banking Details" card.
 *
 * The page is deliberately built around what we control. An account is the one
 * deliverable on this site that a third party grants, so the scope section sits
 * second — above the features — and the page never implies an approval. The
 * documents section follows the process because "what do I need?" is the
 * question that decides whether an application moves or stalls.
 */

export function ServiceBankingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Bank Account Opening — US, UK, Canada & Europe | Marty Global LLC"
        description="Guided business bank account applications for newly formed and non-resident-owned companies: partners matched to your entity, the file prepared and compliance-checked, and the application tracked in your dashboard."
        path="/services/banking"
      />
      <Navbar />
      <main className="flex-1">
        <ServiceDetailHero
          eyebrow="Bank Account Opening"
          breadcrumb="Bank Account Opening"
          title="A Business Account for a Company Registered Where You Don't Live"
          subtitle="We match your entity to partner banks that accept it, prepare and compliance-check the application, and stay with it until there is an answer — across the US, UK, Canada, and Europe, without you flying anywhere."
          primaryCtaLabel="Start Your Application"
          quickFacts={BANKING_QUICK_FACTS}
        />
        <BankingScopeSection />
        <ServiceFeatureGrid
          heading="What the Service Includes"
          subheading="The work that decides whether an application is approved happens before it is submitted."
          features={BANKING_FEATURES}
        />
        <ServiceStepGrid
          heading="How an Application Runs"
          subheading="Four steps from your company details to the bank's decision, tracked in your dashboard throughout."
          steps={BANKING_STEPS}
          columns={4}
          tone="gray"
          footerLink={{ to: '/how-it-works', label: 'See how ordering works' }}
        />
        <BankingRequirementsSection />
        <JurisdictionsStripSection />
        <ServiceQuoteBand lead="Banking support is priced per application, and it varies with the market and the partner — any fee the bank itself charges is separate, and the bank's." />
        <FaqSection
          heading="Bank Account Questions"
          subheading="Eligibility, documents, timelines, and the honest answer about approval."
          faqs={BANKING_FAQS}
        />
        <ServiceRelatedSection
          heading="Often Ordered With Banking"
          subheading="A bank checks the company, its address, and its documents together. These are the pieces it checks."
          services={BANKING_RELATED}
        />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
