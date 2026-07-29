import type { ReactNode } from 'react';

/*
 * The white rounded card every order-detail section sits in — one border,
 * radius, shadow, and title style so the sections read as one system. Padding
 * tightens on mobile (1rem) and opens up from `md` (1.5rem), matching all three
 * Figma links. `titleAccessory` is the optional right-aligned element the
 * design puts beside a title (the Payment status chip).
 */

type SectionCardProps = {
  title: string;
  titleAccessory?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  titleAccessory,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={`flex w-full flex-col rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-card ${className ?? ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h6 font-semibold text-text">{title}</h2>
        {titleAccessory}
      </div>
      {children}
    </section>
  );
}
