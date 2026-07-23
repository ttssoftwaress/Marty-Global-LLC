# Design Guide — Marty Global LLC

Companion to **AGENTS.md**. This file owns how Marty Global looks and how UI
gets built: the design system, Figma handling, the UI build workflow, and the
styling rules. AGENTS.md owns everything else — architecture, backend, data,
money, auth, security. A UI task that changes a shared API shape still follows
AGENTS.md's two-apps sync rule.

---

## Design System First

- Always use the set-up **Design System** before trying any custom CSS or
  Tailwind — Tailwind config tokens + shadcn/ui. If a token or component already
  exists, use it.
- Tailwind utilities with `cn()` and CVA variants; design tokens live in the
  Tailwind config — no hardcoded hex. shadcn is the base; never hand-roll what
  it provides.
- Card entry is always Stripe Elements — never a hand-rolled card input.

---

## Icons — Use the Library, Don't Draw Them

- **Never hand-draw custom SVGs and never export or import icon images from
  Figma.** Icon nodes in a Figma design are a *reference for which glyph to
  use* — not an asset to pull. Match the intent, pull the icon from the library.
- The house icon set is **`lucide-react`** — it ships as shadcn/ui's default,
  so it's already in the stack and matches the component styling out of the box.
  Import per-icon (`import { Mail, CheckCircle } from "lucide-react"`), never the
  whole set.
- Size and color via Tailwind classes on the component (`className="h-5 w-5
  text-primary"`) — no hardcoded hex, no inline `fill`/`stroke` colors. Keep
  stroke width consistent with the shadcn default unless a token says otherwise.
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