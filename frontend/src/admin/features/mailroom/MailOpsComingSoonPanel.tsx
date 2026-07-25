import { Construction } from 'lucide-react';

/*
 * The panel behind the two tabs the design does not cover.
 *
 * All three links draw the "Upload mail" section only, while the tab strip
 * names two more queues — "Pending requests" and "Mail log". Rather than invent
 * screens the design never specified, those tabs render this honest placeholder
 * (Design.md, logged as a deviation). The tab strip stays complete and the
 * counts still surface the backlog; the panel is replaced when those screens
 * are designed.
 */

type MailOpsComingSoonPanelProps = {
  title: string;
  description: string;
};

export function MailOpsComingSoonPanel({
  title,
  description,
}: MailOpsComingSoonPanelProps) {
  return (
    <section className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-12 text-center shadow-sm-elevation lg:py-16">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-light">
        <Construction
          className="size-6 text-primary"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>

      <h2 className="text-h6 text-text">{title}</h2>
      <p className="max-w-[420px] text-body text-text-secondary">{description}</p>
    </section>
  );
}
