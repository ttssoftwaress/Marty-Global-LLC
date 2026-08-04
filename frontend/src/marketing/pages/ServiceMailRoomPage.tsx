import { ServiceCoverageDisclosure } from '../components/services/detail/ServiceCoverageDisclosure';
import { ServiceDetailHero } from '../components/services/detail/ServiceDetailHero';
import { ServiceFeatureGrid } from '../components/services/detail/ServiceFeatureGrid';
import { ServiceQuoteBand } from '../components/services/detail/ServiceQuoteBand';
import { ServiceRelatedSection } from '../components/services/detail/ServiceRelatedSection';
import { ServiceStepGrid } from '../components/services/detail/ServiceStepGrid';
import { JurisdictionsStripSection } from '../components/services/JurisdictionsStripSection';
import { MailRoomUsesSection } from '../components/services/mailroom/MailRoomUsesSection';
import {
  MAILROOM_FAQS,
  MAILROOM_FEATURES,
  MAILROOM_QUICK_FACTS,
  MAILROOM_RELATED,
  MAILROOM_STEPS,
} from '../components/services/mailroom/mailroom-content';
import { FaqSection } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * Virtual Mail Room — a service detail page (`/services/mailroom`), reached from
 * the Services grid's "View Mail Room Details" card.
 *
 * It answers, in order: what an address gets you, what happens to each piece of
 * post, what the room includes, where you actually use the address (and why it
 * is not a Registered Agent), which regions we cover, what it costs (the quote
 * mechanism — never a number), the questions this service raises, and what is
 * ordered with it. Shared sections come from `services/detail/` and their copy
 * from `mailroom-content.ts`.
 *
 * The jurisdictions strip is the same component the Services page uses — one
 * list of regions, and it is hidden below `md` by its own design.
 */

export function ServiceMailRoomPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Virtual Mail Room — Business Address & Mail Scanning | Marty Global LLC"
        description="A real commercial street address in the US, UK, Canada, or Europe. Your post is received, scanned to your dashboard, and forwarded worldwide or securely shredded on request."
        path="/services/mailroom"
      />
      <Navbar />
      <main className="flex-1">
        <ServiceDetailHero
          eyebrow="Virtual Mail Room"
          breadcrumb="Virtual Mail Room"
          title="A Business Address You Can Actually Use — From Anywhere"
          subtitle="Get a real commercial street address in the United States, the UK, Canada, or Europe. We receive your post, scan it into your dashboard, and forward or shred each piece on your instruction."
          primaryCtaLabel="Get Your Address"
          quickFacts={MAILROOM_QUICK_FACTS}
        />
        <ServiceStepGrid
          heading="From Envelope to Your Screen"
          subheading="Every piece of mail follows the same four steps, and you can see where each one is at any time."
          steps={MAILROOM_STEPS}
          columns={4}
          tone="gray"
          footerLink={{ to: '/how-it-works', label: 'See how ordering works' }}
        />
        <ServiceFeatureGrid
          heading="What a Mail Room Includes"
          subheading="The address is the start of it. What makes it usable is everything that happens to the post after it lands."
          features={MAILROOM_FEATURES}
        />
        <MailRoomUsesSection />
        <JurisdictionsStripSection />
        <ServiceCoverageDisclosure
          variant="full"
          heading="Where You Can Have an Address"
          what="a mail desk"
        />
        <ServiceQuoteBand lead="A mail room is an annual subscription per address, priced by the market the address sits in — your dashboard shows each room's renewal date." />
        <FaqSection
          heading="Virtual Mail Room Questions"
          subheading="Addresses, scanning, forwarding, and what happens to the post you never want to see."
          faqs={MAILROOM_FAQS}
        />
        <ServiceRelatedSection
          heading="Often Ordered With a Mail Room"
          subheading="An address is usually one part of setting up somewhere new. These are the services it is ordered alongside."
          services={MAILROOM_RELATED}
        />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
