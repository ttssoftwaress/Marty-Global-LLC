import { AboutHeroSection } from '../components/about/AboutHeroSection';
import { FounderQuoteSection } from '../components/about/FounderQuoteSection';
import { MissionSection } from '../components/about/MissionSection';
import { StorySection } from '../components/about/StorySection';
import { ValuesSection } from '../components/about/ValuesSection';
import { WhyUsSection } from '../components/about/WhyUsSection';
import { FinalCtaSection } from '../components/shared/FinalCtaSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * About Us — marketing page (`/about`). Built section by section; the hero
 * leads. Navbar and Footer are the shared marketing chrome.
 */

export function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="About Us — Marty Global LLC"
        description="Learn who we are: Marty Global LLC is a filing service provider helping founders form and manage companies worldwide, guided by a mission of clarity and trust."
        path="/about"
      />
      <Navbar />
      <main className="flex-1">
        <AboutHeroSection />
        <MissionSection />
        <StorySection />
        <ValuesSection />
        <WhyUsSection />
        <FounderQuoteSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
