import { HeroSection } from '../components/HeroSection';
import { HowItWorksSection } from '../components/HowItWorksSection';
import { ServicesSection } from '../components/ServicesSection';
import { FaqSection } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';
import { TestimonialsSection } from '../components/shared/TestimonialsSection';

/*
 * Home — the default marketing page (`/`). Built section by section; the hero
 * is the first. Navbar and Footer are the shared marketing chrome.
 */

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Marty Global LLC — Launch Your Business Anywhere in the World"
        description="Marty Global LLC forms and manages companies worldwide — registrations, scanned mail, and ongoing compliance handled by one filing partner."
        path="/"
      />
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <ServicesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
