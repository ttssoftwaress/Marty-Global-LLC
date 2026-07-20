import { ContactFormSection } from '../components/contact/ContactFormSection';
import { ContactHeroSection } from '../components/contact/ContactHeroSection';
import { Footer } from '../components/shared/Footer';
import { Navbar } from '../components/shared/Navbar';
import { Seo } from '../components/shared/Seo';

/*
 * Contact Us — marketing page (`/contact`). Built section by section; the hero
 * leads, then the main form (account wizard + contact card). Navbar and Footer
 * are the shared marketing chrome.
 */

export function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title="Contact Us — Marty Global LLC"
        description="Get in touch with Marty Global LLC. Tell us about your company formation or filing needs and our team will help you choose the right services."
        path="/contact"
      />
      <Navbar />
      <main className="flex-1">
        <ContactHeroSection />
        <ContactFormSection />
      </main>
      <Footer />
    </div>
  );
}
