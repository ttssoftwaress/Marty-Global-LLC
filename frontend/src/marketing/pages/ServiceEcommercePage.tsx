import { ServiceDetailHero } from '../components/services/detail/ServiceDetailHero';
import { ServiceFeatureGrid } from '../components/services/detail/ServiceFeatureGrid';
import { ServiceQuoteBand } from '../components/services/detail/ServiceQuoteBand';
import { ServiceRelatedSection } from '../components/services/detail/ServiceRelatedSection';
import { ServiceStepGrid } from '../components/services/detail/ServiceStepGrid';
import { EcommercePlatformsSection } from '../components/services/ecommerce/EcommercePlatformsSection';
import { EcommerceVerificationSection } from '../components/services/ecommerce/EcommerceVerificationSection';
import {
  ECOMMERCE_FAQS,
  ECOMMERCE_FEATURES,
  ECOMMERCE_QUICK_FACTS,
  ECOMMERCE_RELATED,
  ECOMMERCE_STEPS,
} from '../components/services/ecommerce/ecommerce-content';
import { FaqSection } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * E-Commerce Account Setup — a service detail page (`/services/ecommerce`),
 * reached from the Services grid's "View E-Commerce Details" card. The last of
 * the four grid cards to get a screen.
 *
 * Like banking, the deliverable is granted by a third party, so the verification
 * section carries the limits at full weight and the page never implies an
 * approved account. It leads with the marketplaces because that is what a
 * visitor is scanning for, then explains that all four check the same things —
 * which is what makes the formation / address / bank stack the actual product.
 */

export function ServiceEcommercePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="E-Commerce Account Setup — Amazon, eBay, Walmart & Alibaba | Marty Global LLC"
        description="Business seller accounts registered and verified in your company's name on the marketplaces that require a local entity — with the formation, address, and bank details lined up so the checks pass."
        path="/services/ecommerce"
      />
      <Navbar />
      <main className="flex-1">
        <ServiceDetailHero
          eyebrow="E-Commerce Account Setup"
          breadcrumb="E-Commerce Account Setup"
          title="Sell on the Marketplaces That Want a Local Entity Behind You"
          subtitle="We register your business seller account, prepare the identity and address verification each platform runs, and make sure your company, address, and bank account agree with each other before anything is submitted."
          primaryCtaLabel="Start Your Setup"
          quickFacts={ECOMMERCE_QUICK_FACTS}
        />
        <EcommercePlatformsSection />
        <EcommerceVerificationSection />
        <ServiceFeatureGrid
          heading="What the Service Includes"
          subheading="Registration is the easy half. Passing verification as a founder outside the market is the half this service exists for."
          features={ECOMMERCE_FEATURES}
        />
        <ServiceStepGrid
          heading="How a Setup Runs"
          subheading="Four steps from where you want to sell to the platform's own verification, tracked in your dashboard throughout."
          steps={ECOMMERCE_STEPS}
          columns={4}
          tone="gray"
          footerLink={{ to: '/how-it-works', label: 'See how ordering works' }}
        />
        <ServiceQuoteBand lead="E-commerce setup is priced per application, and it varies with the marketplace and the market you are selling into — any fee the platform charges is its own, and separate." />
        <FaqSection
          heading="E-Commerce Setup Questions"
          subheading="Platforms, verification, timelines, and the honest answer about approval."
          faqs={ECOMMERCE_FAQS}
        />
        <ServiceRelatedSection
          heading="What Has to Exist First"
          subheading="A seller account is checked against a company, an address, and a bank account. These are those three."
          services={ECOMMERCE_RELATED}
        />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
