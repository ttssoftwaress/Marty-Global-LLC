# Design Guide — Marty Global LLC

Companion to **AGENTS.md**. This file owns how Marty Global looks and how UI
gets built: the design system, Figma handling, the UI build workflow, and the
styling rules. AGENTS.md owns everything else — architecture, backend, data,
money, auth, security. A UI task that changes a shared API shape still follows
AGENTS.md's two-apps sync rule.

---

## Design System First

Always use the set-up **Design System** before writing custom CSS or reaching
for a raw Tailwind utility. If a token or component class already exists, use it.

**The system is first-party — shadcn/ui is not installed.** See *Why not
shadcn* below; that is a settled decision, not a gap to fill. Do not add
shadcn, Radix, `cn()`, `clsx`, `tailwind-merge`, or CVA without asking (the
AGENTS.md budget rule applies to all of them).

The three layers, in the order to reach for them:

1. **Tokens — `frontend/src/styles/index.css`.** Colors, type scale, radii, and
   shadows are declared once in `@theme` and become both Tailwind utilities
   (`bg-primary`, `text-error`, `rounded-modal`) and CSS variables. **Never
   hardcode a hex.** Sizes in the app surfaces are **rem, never px** — the
   compact-density scheme (`html.app-compact`, 80% root font-size) scales the
   product surfaces by root font-size, and a px value silently opts out of it.
2. **Component classes — `@layer components` in the same file.** `.btn`,
   `.btn-primary`, `.btn-secondary`, `.card`, `.input` and friends. These are
   the shared primitives; compose them with utilities for one-off adjustments.
3. **Feature components — per area.** `portal/features/*`, `admin/features/*`,
   `marketing/components/*`. Areas never import from each other, so a pattern
   used by two areas is intentionally implemented twice rather than shared
   across the boundary (AGENTS.md's route-group rule). Duplication *within* one
   area should be extracted.

Conditional classes are plain template literals or a ternary — there is no
`cn()` helper. Keep the conditional at the call site and readable; do not
introduce a class-merging utility to avoid one.

- Card payments are deferred (AGENTS.md, Payments) — the checkout renders a
  disabled "coming soon" option. Never hand-roll a card input; when the card
  path lands, entry is a provider-hosted element.

### Overlays — use the hook, never hand-roll

Every modal dialog, slide-over, drawer, and bottom sheet uses
**`frontend/src/hooks/useOverlay.ts`**. It owns Escape-to-close, the Tab focus
trap, moving focus into the panel on open, restoring focus to the trigger on
close, and the background scroll lock.

```tsx
const panelRef = useRef<HTMLElement>(null);
useOverlay({ open, onClose, panelRef });
// panel: role="dialog" aria-modal="true" aria-label=… tabIndex={-1} + outline-none
```

Do not re-implement any of that per component. It was hand-written 13 times
before, and the copies drifted: four trapped Tab with a selector that omitted
`input`/`select`/`textarea`, several never restored focus, and one shipped
`aria-modal="true"` with no Escape handler at all.

**Non-modal** popovers — filter dropdowns, status menus — deliberately do *not*
use it. They close on Escape and outside click, return focus to their trigger,
and must leave page scroll and Tab alone. Pattern reference:
`admin/features/orders/OrderFilterDropdown.tsx`.

### Why not shadcn/ui

**Decided July 2026.** Earlier revisions of this file specified shadcn/ui as the
base. It was never installed, and the UI was built as the first-party system
above — roughly 400 components across the marketing site and both portals.

Retrofitting shadcn would mean adding Radix plus three class utilities and
rewriting nearly every component, with real visual-regression risk across three
surfaces, to arrive at a system the existing one already covers. The cost is not
justified by the benefit, so **the first-party system is the design system of
record** and this file documents it.

What that costs us, recorded honestly: no Radix accessibility primitives
underneath the overlays (which is exactly why `useOverlay` exists and is
mandatory), and no upstream component updates. Revisit only as a deliberate,
scheduled migration — not incrementally, and not per-component.

---

## Icons — Use the Library, Don't Draw Them

- **Never hand-draw custom SVGs and never export or import icon images from
  Figma.** Icon nodes in a Figma design are a *reference for which glyph to
  use* — not an asset to pull. Match the intent, pull the icon from the library.
- The house icon set is **`lucide-react`** — it is in the stack and is the only
  icon dependency. Import per-icon (`import { Mail, CheckCircle } from
  "lucide-react"`), never the whole set.
- Size and color via Tailwind classes on the component (`className="size-5
  text-primary"`) — no hardcoded hex, no inline `fill`/`stroke` colors. The
  house stroke width is **`strokeWidth={1.75}`** (2 for small chevrons and other
  fine glyphs); keep it consistent unless a token says otherwise. Decorative
  icons take `aria-hidden="true"`; an icon-only button needs an `aria-label`.
- If `lucide-react` genuinely lacks a glyph, reach for one of these before ever
  hand-rolling — pick one and stay consistent: **Tabler Icons**
  (`@tabler/icons-react`), **Phosphor** (`@phosphor-icons/react`), or
  **Heroicons** (`@heroicons/react`, same family as Tailwind). Brand/logo marks
  (Visa, USDT, etc.) are the only exception — those come in as their own assets.

---

## Figma MCP Context — Pathway, Not Source of Truth

The design context provided via the Figma MCP is the **pathway the agent runs
on** — a strong, authoritative starting direction, **not an inviolable spec**.
Follow it, but you are **free to improve the design where you see fit**: fix
obvious spacing/alignment or type-scale inconsistencies, correct contrast or
accessibility problems, fill in states the design didn't cover (hover, focus,
disabled, empty, loading, error), or make a layout genuinely clearer.

Icons in the Figma context are read for *intent only* — map them to the icon
library (see above), never export them as SVG or image assets.

**The one hard rule: log every deviation in the task summary** — what you
changed and why. For a large departure from the design, say
so briefly at the end in summary.

This is not license to approximate. Absent a reason to improve something,
reproduce the Figma context precisely — layout, spacing, type hierarchy,
colors, radius, shadows. "I improved it" is a deliberate, logged decision — not
a shortcut or a simplification.

---

## The States Figma Doesn't Draw

Designs show the happy path. Every screen that fetches or submits owes four
more states, and they are part of the task — not follow-up work.

- **Loading.** A skeleton in the final layout's shape (`animate-pulse` on
  `bg-gray-200`), not a centered spinner that collapses the page. Mark it
  `aria-hidden="true"` — a skeleton has nothing to announce.
- **Empty.** Distinguish *nothing yet* from *nothing matching a filter*, and say
  which. Icon + one-line heading + a sentence, and the action that resolves it
  where one exists.
- **Error.** Say what failed in plain words and give a **Try again** that
  refetches. Never render a raw error or a status code — the API returns a code
  and the copy is ours (AGENTS.md, API Conventions). An inline submit error
  belongs beside the control that failed, with `role="alert"`.
- **Disabled / in-flight.** A submit disables while its mutation is pending and
  says so (`Sending request…`), so it cannot be double-submitted. If a control
  is disabled for a reason the user could fix, state the reason near it rather
  than leaving a dead button.

A loading state that cannot be distinguished from a failed one is a bug: derive
it from the query's own `isPending`/`isError`, never from "the data is absent".

Keyboard and focus are part of the design, not an afterthought:

- Interactive elements are real `<button>`/`<a>` — never a `div` with `onClick`.
- Focus must stay visible; don't remove an outline without replacing it with a
  `focus-visible` style that meets contrast.
- Icon-only controls carry an `aria-label`; decorative icons are `aria-hidden`.
- Modals follow the overlay hook above; non-modal popovers return focus to their
  trigger when they close.

---

## Workflow — UI Tasks

- **UI task:** analyze the attached design images or Figma MCP context first →
  treat it as the pathway (above) → build with the Design System → reproduce
  faithfully, improving only where warranted → **summary**. The summary must
  include a **Design deviations** line: what you changed from the Figma context
  and why (write "none" if you matched it exactly).
- **Responsive UI task (three Figma links):** when given **three** Figma MCP
  context links for the same design — desktop, mobile, and tablet — build all
  three viewports to match their respective link (layout, spacing, type
  hierarchy, colors, radius, shadows). It is one responsive design across
  breakpoints, not three unrelated screens. The pathway rule still applies:
  improve where warranted and log it.
  - **Text copy comes from the desktop link only:** whenever the copy differs
    across all three or between any two links, the desktop link is the single
    source of truth for wording — mirror its text on mobile and tablet, and
    treat the differing mobile/tablet copy as a design artifact to ignore, not
    a variation to reproduce.