import { useEffect } from 'react';

import { HeroSection } from '../components/HeroSection';
import { HowItWorksSection } from '../components/HowItWorksSection';
import { ServicesSection } from '../components/ServicesSection';
import { FaqSection } from '../components/shared/FaqSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { TestimonialsSection } from '../components/shared/TestimonialsSection';

/*
 * Home — the default marketing page (`/`). Built section by section; the hero
 * is the first. Navbar and Footer are the shared marketing chrome. A dedicated
 * <Seo> component will replace this inline title/meta once it lands.
 */

export function HomePage() {
  useEffect(() => {
    document.title =
      'Marty Global LLC — Launch Your Business Anywhere in the World';
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
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
