import { Construction } from 'lucide-react';

/*
 * Stand-in panel for the customer sections whose real content is not built yet
 * (Profile, Payments, Mail room, Messages — the links only draw the Orders tab).
 *
 * It renders in the same frame the Orders panel uses, so switching tabs never
 * collapses the page or dead-ends on a blank area. Mirrors AdminPlaceholderPage's
 * shape so the two read as the same "not yet" across the admin portal — delete
 * each usage as its real panel lands.
 */

export function CustomerSectionPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-16 text-center shadow-sm-elevation md:rounded-table">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-primary-light">
        <Construction className="size-6 text-primary" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <p className="text-body-lg font-semibold text-text">{title} — coming soon</p>
      <p className="max-w-[26.25rem] text-body text-gray-500">
        This section of the customer record is being built.
      </p>
    </div>
  );
}
