import { ServiceDetailHero } from '../components/services/detail/ServiceDetailHero';
import { ServiceFeatureGrid } from '../components/services/detail/ServiceFeatureGrid';
import { ServiceQuoteBand } from '../components/services/detail/ServiceQuoteBand';
import { ServiceRelatedSection } from '../components/services/detail/ServiceRelatedSection';
import { ServiceRequestGrid } from '../components/services/detail/ServiceRequestGrid';
import { ServiceStepGrid } from '../components/services/detail/ServiceStepGrid';
import { RdpPlansSection } from '../components/services/remote-desktop/RdpPlansSection';
import {
  RDP_FAQS,
  RDP_FEATURES,
  RDP_QUICK_FACTS,
  RDP_RELATED,
  RDP_REQUESTS,
  RDP_STEPS,
} from '../components/services/remote-desktop/remote-desktop-content';
import { ShieldCheckIcon } from '../components/icons';
import { FaqSection } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * Remote Desktop (RDP) — a service detail page (`/services/remote-desktop`).
 *
 * Like Registered Agent it has no card on the Services grid, which is a 2×2 of
 * the four core company-setup services; the footer links here instead. Unlike
 * the rest of the service pages this one sells a specified product rather than a
 * filing, so the plans sit second and the copy names the exact options the order
 * form offers (`seed-catalog.ts`, `remote-desktop`).
 */

export function ServiceRemoteDesktopPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Remote Desktop (RDP) — Dedicated Windows & Linux Servers | Marty Global LLC"
        description="A dedicated Windows or Linux desktop in the cloud, online around the clock: your own vCPU, RAM, and SSD, six data centres across the US, UK, EU, and Asia, set up and handed over within 24 hours."
        path="/services/remote-desktop"
      />
      <Navbar />
      <main className="flex-1">
        <ServiceDetailHero
          eyebrow="Remote Desktop (RDP)"
          breadcrumb="Remote Desktop"
          title="A Desktop in the Cloud That Never Goes Offline"
          subtitle="A dedicated Windows or Linux machine running around the clock in the data centre you choose, reachable from any device you sign in from — sized for one person or a team, and set up within 24 hours."
          primaryCtaLabel="Order Your Server"
          quickFacts={RDP_QUICK_FACTS}
        />
        <RdpPlansSection />
        <ServiceFeatureGrid
          heading="What Comes With the Machine"
          subheading="A server is easy to rent and easy to get wrong. These are the parts that decide whether it is still the right machine in six months."
          features={RDP_FEATURES}
          tone="gray"
        />
        <ServiceStepGrid
          heading="From Order to Sign-In"
          subheading="Four steps, and the last one usually happens the same day."
          steps={RDP_STEPS}
          columns={4}
          footerLink={{ to: '/how-it-works', label: 'See how ordering works' }}
        />
        <ServiceRequestGrid
          heading="Looked After, Not Just Handed Over"
          subheading="Four things you can ask for against a live server, raised from its record in your dashboard — each with the turnaround it carries."
          requests={RDP_REQUESTS}
          note={{
            Icon: ShieldCheckIcon,
            // The order form's software field carries the same warning: a
            // licence key typed into an application form is stored with the
            // order.
            text: 'Never put a licence key or a password in an order form. Name the software you want, and send the keys through a secure channel once the server is ready — we will tell you how.',
          }}
        />
        <ServiceQuoteBand lead="A remote desktop is a subscription priced by plan, billing period, and data centre — monthly, quarterly, or annually, whichever you pick." />
        <FaqSection
          heading="Remote Desktop Questions"
          subheading="Specifications, operating systems, users, and what happens after handover."
          faqs={RDP_FAQS}
        />
        <ServiceRelatedSection
          heading="Often Ordered With a Server"
          subheading="The rest of the stack a business run from somewhere else tends to need."
          services={RDP_RELATED}
        />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
