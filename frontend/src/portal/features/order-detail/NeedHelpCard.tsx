import { HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

/*
 * Need help — the support prompt in the rail. The desktop and tablet links give
 * it a navy-tinted card with a secondary (outline) button; the mobile link
 * tints it soft-pink with a solid accent button. Both treatments are kept per
 * breakpoint since each is a deliberate design choice for its viewport, and the
 * copy is taken from the desktop link (the source of truth for wording).
 */

export function NeedHelpCard({ supportHref }: { supportHref: string }) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-soft-pink bg-accent-light p-5 md:border-transparent md:bg-primary-light md:p-card">
      <HelpCircle
        className="hidden size-6 text-primary md:block"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <p className="text-body leading-relaxed text-text">
        Contact our support team for assistance with this order.
      </p>
      {/* Accent (solid) button on mobile, secondary (outline) from md — the two
          links use different button variants, so each renders at its breakpoint
          rather than overriding one component class with another. */}
      <Link
        to={supportHref}
        className="btn btn-accent h-input w-full rounded-input text-button md:hidden"
      >
        Contact support
      </Link>
      <Link
        to={supportHref}
        className="btn btn-secondary hidden h-input w-full rounded-input text-button md:inline-flex"
      >
        Contact support
      </Link>
    </section>
  );
}
