import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

/*
 * Shared chrome for the three legal pages (/legal/privacy, /legal/terms,
 * /legal/cookies). They are long-form documents rather than marketing sections,
 * so this file owns the one layout all three use: a compact hero, a sticky
 * table of contents, and the measured prose column.
 *
 * Three breakpoints, following the marketing scale already in use:
 *   - mobile (<768px):  px-4, hero pt-10/pb-8, TOC as a plain card above the
 *     body, 15px/26 prose.
 *   - tablet (md, 768px): px-10, hero py-14, prose capped at a readable measure.
 *   - desktop (lg, 1024px): px-20, hero py-16, two columns — a 260px sticky TOC
 *     rail beside the 1fr prose column, the whole thing capped at 1200px.
 *
 * The TOC is built from the section ids the page declares, so adding a section
 * to a document adds its link automatically — no second list to keep in sync.
 */

export type LegalSectionMeta = {
  id: string;
  title: string;
};

type LegalPageLayoutProps = {
  eyebrow: string;
  title: string;
  intro: string;
  /** Absolute date this version took effect, e.g. "29 July 2026". */
  effectiveDate: string;
  sections: LegalSectionMeta[];
  children: ReactNode;
};

export function LegalPageLayout({
  eyebrow,
  title,
  intro,
  effectiveDate,
  sections,
  children,
}: LegalPageLayoutProps) {
  const activeId = useActiveSection(sections);

  return (
    <>
      <section className="flex w-full flex-col items-start gap-4 bg-gray-50 px-4 pb-8 pt-10 md:gap-5 md:px-10 md:py-14 lg:px-20 lg:py-16">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start gap-4 md:gap-5">
          <span className="inline-flex items-center rounded-pill bg-primary-light px-4 py-1.5 text-[11px] font-semibold uppercase text-primary">
            {eyebrow}
          </span>

          <h1 className="w-full font-marketing text-[30px] font-bold leading-[38px] text-text md:text-[38px] md:leading-[48px] lg:text-[44px] lg:leading-[54px]">
            {title}
          </h1>

          <p className="w-full text-[14px] font-normal leading-[22px] text-text-secondary md:text-[16px] md:leading-[26px] lg:max-w-[860px] lg:text-[17px] lg:leading-[28px]">
            {intro}
          </p>

          <p className="text-[12px] font-medium text-gray-500 md:text-[13px]">
            Effective {effectiveDate}
          </p>
        </div>
      </section>

      <section className="w-full bg-white px-4 py-10 md:px-10 md:py-14 lg:px-20 lg:py-16">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 lg:flex-row lg:items-start lg:gap-16">
          <TableOfContents sections={sections} activeId={activeId} />
          <div className="flex min-w-0 flex-1 flex-col gap-8 md:gap-10">
            {children}
          </div>
        </div>
      </section>
    </>
  );
}

function TableOfContents({
  sections,
  activeId,
}: {
  sections: LegalSectionMeta[];
  activeId: string | null;
}) {
  return (
    <nav
      aria-label="On this page"
      className="w-full rounded-card border border-gray-200 bg-gray-50 p-4 md:p-5 lg:sticky lg:top-8 lg:w-[260px] lg:shrink-0"
    >
      <h2 className="font-marketing text-[13px] font-semibold uppercase tracking-wide text-text md:text-[14px]">
        On this page
      </h2>
      <ol className="mt-3 flex flex-col gap-1.5 md:mt-4 md:gap-2">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={`flex gap-2 text-[13px] leading-[20px] transition-colors hover:text-primary md:text-[13px] ${
                activeId === section.id
                  ? 'font-semibold text-primary'
                  : 'text-text-secondary'
              }`}
            >
              <span className="shrink-0 tabular-nums">{index + 1}.</span>
              <span className="min-w-0">{section.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/*
 * Highlights the section currently in view. `rootMargin` pulls the observation
 * band to the top third of the viewport so the heading being *read* wins rather
 * than whichever section happens to be tallest on screen.
 */
function useActiveSection(sections: LegalSectionMeta[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ids = sections.map((section) => section.id).join(',');

  useEffect(() => {
    const elements = ids
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -66% 0px', threshold: 0 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}

/*
 * One numbered section of a legal document. `scroll-mt` clears the sticky
 * offset so an anchor jump does not park the heading under the viewport edge.
 */
export function LegalSection({
  id,
  title,
  children,
}: LegalSectionMeta & { children: ReactNode }) {
  return (
    <section
      id={id}
      className="flex scroll-mt-20 flex-col gap-3 md:gap-4 lg:scroll-mt-8"
    >
      <h2 className="font-marketing text-[20px] font-semibold leading-[28px] text-text md:text-[24px] md:leading-[32px] lg:text-[26px] lg:leading-[34px]">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-[14px] leading-[24px] text-text-secondary md:gap-4 md:text-[15px] md:leading-[26px] lg:text-[16px] lg:leading-[28px]">
        {children}
      </div>
    </section>
  );
}

/** A bulleted list inside a `LegalSection`, styled to the prose scale. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-gray-400 md:gap-2.5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/*
 * A callout for the things a reader must not miss — the not-a-law-firm notice,
 * the no-refund-after-filing rule, the crypto finality warning. Accent-tinted so
 * it reads as emphasis without becoming an error state.
 */
export function LegalCallout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-accent/20 bg-accent-light p-4 md:p-5">
      <p className="font-marketing text-[14px] font-semibold text-text md:text-[15px]">
        {title}
      </p>
      <div className="text-[13px] leading-[22px] text-text-secondary md:text-[14px] md:leading-[24px]">
        {children}
      </div>
    </div>
  );
}
