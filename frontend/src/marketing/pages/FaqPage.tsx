import { Helmet } from 'react-helmet-async';

import { FaqContactSection } from '../components/faq/FaqContactSection';
import { FaqHeroSection } from '../components/faq/FaqHeroSection';
import { FaqLibrarySection } from '../components/faq/FaqLibrarySection';
import { FAQ_CATEGORIES } from '../components/faq/faq-content';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * FAQ — marketing page (`/faq`). The full question library, grouped by topic,
 * with the short per-page `FaqSection` accordions on home / services /
 * how-it-works pointing here for the rest.
 *
 * The whole library renders in the markup (search filters what is already
 * there, it does not fetch), so the questions are indexable — which is what
 * makes the schema.org block below worth emitting.
 */

/*
 * FAQPage structured data. Search engines surface these as expandable answers
 * on the results page, and this is the one marketing route where that applies.
 * Answers are the same strings the page renders — the schema must not claim
 * anything the visible page does not say.
 */
function faqSchema() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_CATEGORIES.flatMap((category) =>
      category.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    ),
  });
}

export function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="FAQ — Marty Global LLC"
        description="Answers on company formation, business bank accounts, the Virtual Mail Room, quotes and USDT payment, and how Marty Global LLC handles your filings across the US, UK, Canada, and the EU."
        path="/faq"
      />
      <Helmet>
        <script type="application/ld+json">{faqSchema()}</script>
      </Helmet>
      <Navbar />
      <main className="flex-1">
        <FaqHeroSection />
        <FaqLibrarySection />
        <FaqContactSection />
      </main>
      <Footer />
    </div>
  );
}
