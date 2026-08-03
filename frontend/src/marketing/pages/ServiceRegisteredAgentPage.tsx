import { ServiceDetailHero } from '../components/services/detail/ServiceDetailHero';
import { ServiceFeatureGrid } from '../components/services/detail/ServiceFeatureGrid';
import { ServiceQuoteBand } from '../components/services/detail/ServiceQuoteBand';
import { ServiceRelatedSection } from '../components/services/detail/ServiceRelatedSection';
import { ServiceStepGrid } from '../components/services/detail/ServiceStepGrid';
import { RegisteredAgentRoleSection } from '../components/services/registered-agent/RegisteredAgentRoleSection';
import {
  AGENT_FAQS,
  AGENT_FEATURES,
  AGENT_QUICK_FACTS,
  AGENT_RELATED,
  AGENT_STEPS,
} from '../components/services/registered-agent/registered-agent-content';
import { FaqSection } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * Registered Agent — a service detail page (`/services/registered-agent`).
 *
 * Unlike the other detail pages this one has no card of its own on the Services
 * grid: the agent is sold as part of formation and named in the note under the
 * grid, which now links here. It exists as a page because it is also orderable
 * on its own (a company formed elsewhere switching agent), and because "what is
 * a registered agent" is the question the formation page raises and does not
 * have room to answer.
 *
 * Order: what it is and what lapses without it, what the service includes, how
 * the appointment runs, what it costs (the quote mechanism — never a number),
 * the questions it raises, and what it is ordered with.
 */

export function ServiceRegisteredAgentPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Registered Agent Service — All 50 US States | Marty Global LLC"
        description="We act as your registered agent and registered office: the address on the public record, service of process and state notices scanned to your dashboard the same day, and a reminder before the annual renewal."
        path="/services/registered-agent"
      />
      <Navbar />
      <main className="flex-1">
        <ServiceDetailHero
          eyebrow="Registered Agent"
          breadcrumb="Registered Agent"
          title="The Address the State Serves — Covered in All 50 States"
          subtitle="We act as your registered agent and registered office: our address goes on the public record, anything the state serves on your company is scanned to your dashboard the day it arrives, and we keep the appointment current year after year."
          primaryCtaLabel="Appoint Us as Your Agent"
          quickFacts={AGENT_QUICK_FACTS}
        />
        <RegisteredAgentRoleSection />
        <ServiceFeatureGrid
          heading="What the Service Includes"
          subheading="An appointment is not a mailbox. It is a standing obligation to the state, and these are the parts of it we carry."
          features={AGENT_FEATURES}
        />
        <ServiceStepGrid
          heading="How the Appointment Runs"
          subheading="Four steps to appoint us, and then it looks after itself until the renewal comes round."
          steps={AGENT_STEPS}
          columns={4}
          tone="gray"
          footerLink={{ to: '/how-it-works', label: 'See how ordering works' }}
        />
        <ServiceQuoteBand lead="Registered Agent is an annual appointment per company, priced by the state or country it is filed in — and the first year is included with every US formation." />
        <FaqSection
          heading="Registered Agent Questions"
          subheading="What the role is, whether you can hold it yourself, and what happens if nobody does."
          faqs={AGENT_FAQS}
        />
        <ServiceRelatedSection
          heading="Often Ordered With an Agent"
          subheading="The appointment covers what the state sends. These cover everything else a company needs to operate from somewhere else."
          services={AGENT_RELATED}
        />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
