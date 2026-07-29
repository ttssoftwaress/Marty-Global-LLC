import type { ReactNode } from 'react';

/*
 * The white card every section of the order screen sits in — the same frame the
 * rest of the admin portal uses (border, card radius, small elevation), with a
 * title row that can carry a trailing element.
 *
 * It exists here rather than being repeated per card so the seven sections keep
 * one padding and one heading scale between them; the portal's order screen has
 * its own copy for the same reason (the two areas never import from each other).
 */

type SectionCardProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  action,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={`flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-5 lg:p-card ${className ?? ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body-lg font-semibold text-text">{title}</h2>
        {action}
      </div>

      {children}
    </section>
  );
}
