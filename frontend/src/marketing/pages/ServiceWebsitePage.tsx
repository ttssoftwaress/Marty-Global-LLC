import { ShieldCheckIcon } from '../components/icons';
import { ServiceDetailHero } from '../components/services/detail/ServiceDetailHero';
import { ServiceFeatureGrid } from '../components/services/detail/ServiceFeatureGrid';
import { ServiceQuoteBand } from '../components/services/detail/ServiceQuoteBand';
import { ServiceRelatedSection } from '../components/services/detail/ServiceRelatedSection';
import { ServiceRequestGrid } from '../components/services/detail/ServiceRequestGrid';
import { ServiceStepGrid } from '../components/services/detail/ServiceStepGrid';
import { WebsiteTypesSection } from '../components/services/website/WebsiteTypesSection';
import {
  WEBSITE_FAQS,
  WEBSITE_FEATURES,
  WEBSITE_QUICK_FACTS,
  WEBSITE_RELATED,
  WEBSITE_REQUESTS,
  WEBSITE_STEPS,
} from '../components/services/website/website-content';
import { FaqSection } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * Website Design & Development — a service detail page (`/services/website`).
 *
 * Like Remote Desktop and Registered Agent it has no card on the Services grid,
 * which is the four company-setup services; the footer links here. The site
 * types lead the page because that is the brief's first question and the one
 * that scopes every answer after it (`seed-catalog.ts`, `website`).
 */

export function ServiceWebsitePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Website Design & Development — Sites, Stores & Web Apps | Marty Global LLC"
        description="A designed, built, and hosted website for your company — brochure site, online store, landing page, publication, or custom build — with the domain, hosting, and SSL handled. Delivered in 2 to 4 weeks."
        path="/services/website"
      />
      <Navbar />
      <main className="flex-1">
        <ServiceDetailHero
          eyebrow="Website Design & Development"
          breadcrumb="Website Design & Development"
          title="A Site Your Company Can Send People To"
          subtitle="Designed, built, and launched for you — a brochure site, an online store, a landing page, a publication, or a custom build — with the domain, hosting, and SSL handled and the whole thing delivered in two to four weeks."
          primaryCtaLabel="Start Your Brief"
          quickFacts={WEBSITE_QUICK_FACTS}
        />
        <WebsiteTypesSection />
        <ServiceFeatureGrid
          heading="What the Build Covers"
          subheading="The design and the code are the visible half. The domain, the hosting, and the content are what usually stall a launch."
          features={WEBSITE_FEATURES}
          tone="gray"
        />
        <ServiceStepGrid
          heading="From Brief to Live"
          subheading="Four steps over two to four weeks, with the brief doing most of the work up front."
          steps={WEBSITE_STEPS}
          columns={4}
          footerLink={{ to: '/how-it-works', label: 'See how ordering works' }}
        />
        <ServiceRequestGrid
          heading="After It Launches"
          subheading="Three things you can ask for against a live site, raised from its record in your dashboard — each with the turnaround it carries."
          requests={WEBSITE_REQUESTS}
          columns={3}
          note={{
            Icon: ShieldCheckIcon,
            text: 'A new feature is quoted before any work starts, so asking what something would take never turns into an invoice you did not agree to.',
          }}
        />
        <ServiceQuoteBand lead="A website is priced by what it is — the kind of site, how many pages, the features it needs, and whether we write the content — with hosting and the domain renewing annually." />
        <FaqSection
          heading="Website Questions"
          subheading="Site types, platforms, domains, content, and what happens after launch."
          faqs={WEBSITE_FAQS}
        />
        <ServiceRelatedSection
          heading="Often Ordered With a Website"
          subheading="A site is the public face of the rest of it. These are the parts behind it."
          services={WEBSITE_RELATED}
        />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
