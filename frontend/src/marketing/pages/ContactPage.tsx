import { ContactForm } from '../features/leads/ContactForm';
import { LeadList } from '../features/leads/LeadList';
import { Footer } from '../components/shared/Footer';

export function ContactPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold text-slate-900">Marty Global LLC</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tell us about your company and we will get back to you.
        </p>
      </header>

      <div className="grid gap-12 md:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-medium text-slate-900">Contact us</h2>
          <ContactForm />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-slate-900">
            Submitted enquiries
          </h2>
          <LeadList />
        </section>
      </div>
        <Footer />
    </main>

  );
}
