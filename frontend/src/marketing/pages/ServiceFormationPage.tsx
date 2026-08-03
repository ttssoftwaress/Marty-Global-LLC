import { ServiceDetailHero } from '../components/services/detail/ServiceDetailHero';
import { ServiceFeatureGrid } from '../components/services/detail/ServiceFeatureGrid';
import { ServiceQuoteBand } from '../components/services/detail/ServiceQuoteBand';
import { ServiceRelatedSection } from '../components/services/detail/ServiceRelatedSection';
import { ServiceStepGrid } from '../components/services/detail/ServiceStepGrid';
import { FormationEntityTypesSection } from '../components/services/formation/FormationEntityTypesSection';
import { FormationJurisdictionsSection } from '../components/services/formation/FormationJurisdictionsSection';
import {
  FORMATION_FAQS,
  FORMATION_FEATURES,
  FORMATION_QUICK_FACTS,
  FORMATION_RELATED,
  FORMATION_STEPS,
} from '../components/services/formation/formation-content';
import { FaqSection } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * Company Formation — a service detail page (`/services/formation`), reached
 * from the Services grid's "View Formation Details" card.
 *
 * The page answers, in order: what we file, what the order includes, where we
 * file it and what each registry needs, how the process runs, what it costs (the
 * quote mechanism — never a number), the questions this service raises, and what
 * is usually ordered with it. The shared sections come from `services/detail/`
 * and their copy from `formation-content.ts`; only the entity types and the
 * jurisdiction cards are specific to this service. Navbar and Footer are the
 * shared marketing chrome, and the navbar keeps "Services" active because the
 * path is inside its subtree.
 */

export function ServiceFormationPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Company Formation — LLC, INC & LTD | Marty Global LLC"
        description="Register an LLC or INC in any US state, or an LTD in the UK, Canada, and Europe. Entity filing, corporate documents, one year of Registered Agent service, and EIN support — quoted per jurisdiction."
        path="/services/formation"
      />
      <Navbar />
      <main className="flex-1">
        <ServiceDetailHero
          eyebrow="Company Formation"
          breadcrumb="Company Formation"
          title="Register Your LLC, INC or LTD — Wherever You're Building"
          subtitle="We file your entity with the local state or national registry, prepare the standard corporate documents, and hand the whole record to you in your dashboard — LLC and INC in the United States, LTD in the UK, Canada, and Europe."
          primaryCtaLabel="Start Your Formation"
          quickFacts={FORMATION_QUICK_FACTS}
        />
        <FormationEntityTypesSection />
        <ServiceFeatureGrid
          heading="What a Formation Order Includes"
          subheading="One order covers the filing and everything that has to exist around it for the company to actually be usable."
          features={FORMATION_FEATURES}
        />
        <FormationJurisdictionsSection />
        <ServiceStepGrid
          heading="How a Formation Runs"
          subheading="Five steps from the application to the certificate, tracked in your dashboard the whole way."
          steps={FORMATION_STEPS}
          footerLink={{ to: '/how-it-works', label: 'See the full process' }}
        />
        <ServiceQuoteBand lead="Formation is priced per jurisdiction, because each registry charges its own government fee." />
        <FaqSection
          heading="Company Formation Questions"
          subheading="The questions founders ask before filing — entities, jurisdictions, timelines, and what arrives at the end."
          faqs={FORMATION_FAQS}
        />
        <ServiceRelatedSection
          heading="Often Ordered With Formation"
          subheading="A registered company usually needs an address and a bank account before it can trade. Order them together and the details you have already given carry across."
          services={FORMATION_RELATED}
        />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
