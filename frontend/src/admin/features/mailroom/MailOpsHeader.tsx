/*
 * The screen's header — breadcrumb, title, and subtitle.
 *
 * All three links carry the same three lines; only the title's size changes
 * (1.5rem on mobile, 32px from tablet up). The breadcrumb stays at every width —
 * the mobile link draws it too, unlike most other admin screens.
 *
 * The custom `.text-*` classes are `@layer components`, so a responsive variant
 * of one is inert (Design.md / the type-token layering note) — the title steps
 * with explicit `text-[Npx]` sizes instead.
 */

export function MailOpsHeader() {
  return (
    <header className="flex w-full flex-col gap-2">
      <p className="text-caption font-semibold uppercase tracking-[0.4px] text-gray-400">
        Dashboard / Virtual mail ops
      </p>

      <h1 className="text-[1.5rem] font-semibold leading-8 text-text lg:text-[2rem] lg:leading-10">
        Virtual mail room — operations
      </h1>

      <p className="text-body text-text-secondary">
        Upload scanned mail and process forwarding or shredding requests.
      </p>
    </header>
  );
}
