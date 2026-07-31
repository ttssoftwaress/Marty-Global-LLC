# AGENTS.md — Marty Global LLC

You are an expert full-stack TypeScript engineer building **Marty Global LLC**,
a corporate filing service provider. Clean, simple, maintainable code — clarity
over abstraction. Think like a senior engineer on a production SaaS.

Design, styling, and the UI build workflow live in **Design.md** (the
companion to this file). Everything else — architecture, backend, data, money,
auth, security — lives here.

---

## Project

Customers form and manage companies, file registrations, receive scanned mail,
get support, and pay in USDT (TRC-20) or by bank transfer. Live chat, email/SMS
notifications, audit logging.

**Card payments are deferred to a later deployment.** There is no card code in
either app — no provider SDK, no models, no env, no checkout — and none is to be
added until that deployment is scoped. The portal shows cards as "coming soon".

Three surfaces, two apps:

- `frontend/` — one React SPA: marketing site (`/`), customer portal (`/app`),
  admin portal (`/admin`)
- `backend/` — one Express service: REST API, Socket.io live chat, and
  background jobs — one codebase, one process

---

## Two Independent Apps — The Core Rule

```
corporate-filing-system/
├── AGENTS.md
├── Design.md            # design system, Figma handling, UI build workflow
├── frontend/            # React + Vite SPA
├── backend/             # Express API + jobs + Dockerfile
├── docker-compose.yml   # local Postgres + Redis
└── README.md
```

- `frontend/` and `backend/` are **fully self-contained**: each has its own
  `package.json`, `node_modules`, tsconfig, `.env`, and scripts. Zip either
  folder and it builds alone.
- **Nothing is shared.** No shared folder, no cross-directory imports or path
  aliases, no shared components, constants, types, or node_modules. Their only
  connection is HTTP at runtime.
- **Context is shared, code is not.** You can read both apps. The backend is
  the source of truth for API shapes and the plan catalog; the frontend keeps
  its own local copies in `src/types` and `src/constants`. When an endpoint or
  the catalog changes, update **both apps in the same task** — you are the
  sync mechanism.
- npm in both apps. Dev = two terminals, `npm run dev` in each.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Core | **PERN** — PostgreSQL, Express, React, Node (all TypeScript, npm) |
| Frontend | React + Vite + React Router |
| UI | Tailwind (first-party design system — **not** shadcn/ui; see Design.md) |
| State | TanStack Query (server). No client-state library — see below. |
| SEO | react-helmet-async (marketing meta tags) |
| Dates | date-fns — the only date library |
| ORM / DB | Prisma / PostgreSQL |
| Cache / Queue | Redis + BullMQ |
| Auth | Better Auth |
| Live chat | Socket.io |
| Email / SMS | Amazon SES (React Email) / Twilio |
| Payments | USDT TRC-20 via TronGrid · bank transfer, settled by staff (cards deferred — see Payments) |
| Bot protection | Cloudflare Turnstile (public forms) |
| Storage | Cloudflare R2 |
| Monitoring / Analytics | Sentry / PostHog |
| Testing | Vitest + Playwright |
| Deploy | Backend: Docker on a VPS · Frontend: static build (host TBD) |

This list is the budget. Never add a library without asking first.

**Client state:** Zustand was in this table but was never imported anywhere, so
it was uninstalled (July 2026). Server state is TanStack Query's; everything
else has been local `useState` or props, and no genuinely global client state
has appeared yet. If one does, ask before adding a store library — a React
context is usually enough. The same applies to the UI row: shadcn/ui was
specified here and never installed, and the first-party system that exists
instead is now the one of record (Design.md, *Why not shadcn*).

---

## Workflow

Every task ends with a **short summary: what was built, what changed, how to
test it.**

- **UI / design / responsive tasks:** see **Design.md** — it owns the
  design system, Figma MCP handling, the UI build workflow, and the styling
  rules. The design-deviation logging rule there is part of the summary.
- **Backend / logic task:** understand the prompt → read this file and follow
  it strictly → build → summary.
- No plan-approval step — build directly. If something is unclear or a better
  approach exists, say so briefly first.
- Keep changes focused; never rewrite unrelated code. Smallest useful version
  first; refactor only when repetition appears.

---

## Frontend (`frontend/`)

```
frontend/src/
├── app/          # router.tsx, providers.tsx, layouts/
├── marketing/    # public pages: home, services, how-it-works, faq, about, contact, legal
├── portal/       # customer portal: pages/ + features/
├── admin/        # admin portal: pages/ + features/
├── auth/         # sign-in/up screens + auth client (used by portal & admin)
├── services/     # api.ts, socket.ts, upload.ts
├── constants/    # local mirror: roles, statuses (backend = source of truth)
├── types/        # local mirror of API shapes
├── hooks/        # cross-area hooks — useOverlay (all modals), useCompactScale, useSocket
├── lib/  styles/  assets/
```

- There is no top-level `components/` directory. Shared styling lives in the
  token + `@layer components` layer in `styles/index.css`, and UI components
  live inside the area that owns them (`portal/features/*`, `admin/features/*`,
  `marketing/components/*`) — areas never import from each other, so a pattern
  two areas need is implemented in each. Design.md owns the full rationale.
- No `stores/` — see the client-state note under Tech Stack.

- Route groups: `/` marketing (public) · `/app/*` portal (authenticated) ·
  `/admin/*` admin (staff/admin roles). Each area lazy-loads at the router;
  areas never import from each other.
- `pages/` = route screens that compose; `features/` = per-area domain logic
  (queries/mutations, feature components). `portal/features/payments` owns the
  branded checkout: the USDT screen, the bank-transfer screen, and the
  coming-soon card option beside them. **Which methods exist is a server
  answer** (`GET /v1/payments/methods`), never a frontend constant — they are
  admin settings, and a hardcoded list would offer a method the backend refuses
  and keep offering it after someone switched it off.
- Marketing is **simple pages, no blog** — copy written directly in the page
  components. A shared `<Seo>` component sets title/description/canonical/OG
  per page; sitemap + robots at build.
- **Marketing never quotes a price.** There is no pricing page and no price
  copy: an amount depends on the service, the jurisdiction, and that
  jurisdiction's government fees, and the binding figure is the itemised quote
  issued in the customer's portal after review. Services are priced from the
  admin-managed catalog (`/admin/catalog`), never from a frontend constant, so
  marketing points at the quote instead of naming a number it would be wrong
  about. Money questions on `/faq` say exactly this.
- Marty Global is a filing service provider, **not a law firm** — never write
  legal advice or imply attorney representation; keep the footer disclaimer.
  Never invent statistics, testimonials, or guarantees.
- The contact form POSTs to a public backend endpoint — rate-limited and
  Turnstile-verified server-side. The browser never calls a third party
  directly.

---

## Backend (`backend/`)

```
backend/
├── Dockerfile
├── prisma/          # schema.prisma, migrations/, seed.ts
└── src/
    ├── server.ts    # boots API + registers job workers (one process)
    ├── app.ts       # Express setup
    ├── routes.ts    # mounts module routers — nothing else
    ├── config/      # env.ts (Zod, fail fast) + one file per external service
    ├── modules/     # auth users companies registrations documents mailroom
    │                # support notifications billing payments audit
    ├── jobs/        # queues.ts (definitions + producers) · processors/
    ├── sockets/     # live chat
    ├── middlewares/  guards/  lib/
```

Module pattern — self-contained, four files:

```
modules/companies/
├── companies.routes.ts       # router
├── companies.controller.ts   # request/response only
├── companies.service.ts      # business logic — the ONLY layer touching Prisma
└── companies.validation.ts   # Zod schemas — the wire contract's source of truth
```

- Controllers thin: validate → call service → respond. Services own all logic
  and all Prisma access; no raw SQL without asking.
- Jobs run **in-process**: the API enqueues via `jobs/queues.ts`; processors
  import module services, so logic lives once. Every processor is idempotent
  and retry-safe. Split into a separate process only when load demands it.
- Better Auth is the one raw-body route — mount it before the JSON parser. Any
  future provider webhook follows the same rule so signatures verify.
- CORS: exactly the frontend origin, from env. No wildcards.
- Every state change on companies, registrations, billing, payments, and
  documents writes an audit entry through the `audit` module.
- Deploys are undecided — ship as a Docker image to the VPS; do not add CI
  workflows without asking.

---

## API Conventions

- Versioned base path `/v1`. One envelope, always: `{ data }` on success,
  `{ error: { code, message, details? } }` on failure — codes are a string
  enum in the backend's constants. Never invent an ad-hoc shape.
- Errors flow through the shared error middleware; controllers throw typed app
  errors. Never leak stack traces or provider errors — log the detail, return
  a code.
- 400 validation · 401 unauthenticated · 403 unauthorized · 404 missing ·
  409 conflict · 422 business rule · 429 rate-limited.
- Lists use cursor pagination: `?cursor=&limit=` → `{ data, nextCursor }`.
  Mutating payment endpoints accept an `Idempotency-Key` header and are
  retry-safe.
- Every endpoint is authenticated and role-guarded **by default**. Public
  endpoints (contact form, webhooks, health) are explicitly marked and
  rate-limited.

---

## Database & Dates

- Prisma lives in `backend/prisma/`; schema changes go through migrations
  only — never edit the database by hand.
- Every model: `id` cuid, `createdAt`/`updatedAt`. Customer-facing records
  soft-delete via `deletedAt` — filings and payments carry regulatory
  retention; **ask before any hard delete**.
- Timestamps are `timestamptz` in UTC; convert to the user's timezone only at
  render. Filing deadlines store the jurisdiction's timezone — never build a
  deadline from a zoneless string.

---

## Money — Absolute Rules

- Never JS floats for money: no `parseFloat`, no `Number` math, no `toFixed`
  arithmetic.
- Fiat = integer minor units + ISO 4217 code. `1250` + `"USD"`, never `12.50`.
- USDT has 6 decimals; store TronGrid's raw integer (`BigInt` /
  `Decimal(38,0)`) plus decimals; convert for display only, with
  `Intl.NumberFormat`.
- The client never decides an amount — the backend resolves it from the plan
  catalog or invoice when creating an intent.
- USD invoices paid in USDT lock the rate at quote time (stored with expiry,
  re-checked before crediting). Under/overpayment is an explicit status, never
  a silent pass.

---

## Payments

`billing/` owns what is owed; `payments/` owns collecting it. A `Payment` row
is the source of truth, storing the provider reference (the Tron tx hash, or the
bank's reference for a wire). Reconciliation runs in job processors, never in
request handlers; every state change is audited.

Two providers, settled by opposite mechanisms. Both end in one credit path —
`creditQuote` in `payments.service.ts` — so a settled invoice looks identical
whichever way the money came in.

- **Card — DEFERRED, do not build.** No provider SDK, no `StripeCustomer` /
  `PaymentMethod` / `WebhookEvent` models, no `STRIPE` provider value, no card
  columns, no env vars, no checkout. The portal renders a disabled "coming soon"
  option and nothing behind it. Do not scaffold any of it "ready for later" —
  the last attempt left empty tables that read as a working feature and a
  billing screen querying a table with no writer.
- **Never store a PAN or CVC** — no column, log, or endpoint, ever (PCI DSS;
  keeps us in SAQ A scope). If a task seems to need raw card data, stop.
- **USDT:** a repeatable job polls TronGrid, verifies the real USDT contract
  address (fake tokens reuse the name), matches a pending `Payment` by
  address + amount, and credits only after required confirmations. Unique
  constraint on tx hash; match + credit in one DB transaction — never
  double-credit. **No private keys anywhere** — we watch transfers, we never
  sign or move funds.
- **Wire transfer:** the customer is shown bank details and a reference; nothing
  reads a bank feed, so a person on the team confirms the money arrived. No
  expected-amount matching (a wire carries free text, so the quote's reference
  identifies it) and **no expiry** — a transfer can be days in flight, and
  taking the instructions away mid-flight is the one thing this must never do.
  The details shown are **snapshotted onto the payment** at intent time, so
  editing the account later never rewrites instructions somebody is acting on.

**Payment configuration is DATA, not env.** The deposit address, the USD→USDT
rate, the rate TTL, the confirmation depth, the poll interval, the
automatic-verification switch, and the bank accounts all live in
`PaymentSettings` / `BankAccount` and are edited at `/admin/settings` →
Payments. **Do not put a payment address, amount, or threshold back into
`config/env.ts`.** Only two payment values remain in env, each for a reason that
does not generalise: `TRONGRID_API_KEY` (a credential) and `TRON_NETWORK` (it
pins which hardcoded USDT contract a transfer is verified against).

Bank details are **admin-defined label/value rows** (`BankAccountField`), never
fixed `iban` / `swift` / `sortCode` columns — banking is not the same shape in
two countries, and fixed columns would make every new market a migration.

- **Settling by hand takes `payments.settle`** — its own grantable permission
  area, separate from `payments` (which only opens the ledger). It is the
  highest-consequence write in the system: nothing downstream will ever
  contradict it, because there is no feed to disagree with the person who
  clicked. The write is conditional on the payment still being open, so two
  settlers credit exactly once.
- **A USDT payment may only be settled by hand while automatic verification is
  off.** With the poller running, a manual settlement would route around the
  confirmation depth and rate lock the customer was quoted, and strand the real
  transfer in the unmatched queue.
- **"I've sent it" is a claim, never a settlement.** It stamps the row so it
  sorts to the top of the team's queue and does nothing else. A customer must
  not be able to settle their own invoice.
- Each payment locks the **rate and the confirmation depth it was quoted** onto
  its own row, because both settings are now editable — reading the live value
  mid-flight would change a promise already made.

---

## Auth

Better Auth only — no custom sessions or password handling. Roles: customer,
staff, admin. Backend guards are the real boundary; frontend route guards are
convenience.

---

## Live Chat

Real-time customer support over Socket.io, owned by the `support` module.
Sockets are **transport only** — every message and conversation is persisted
through the `support` service (the one layer touching Prisma), so history
survives reconnects and process restarts. Never treat an in-memory socket as
the source of truth.

- **Auth on connect:** every socket authenticates with the same Better Auth
  session as the REST API; reject unauthenticated connections. Live chat is a
  portal + admin feature — customers connect to their own conversations, staff
  and admin can join any. Guards are enforced server-side, exactly like the API.
- **Rooms:** one room per support conversation. A customer is scoped to their
  own conversation(s); staff/admin join by conversation id after an ownership/
  role check in the service layer.
- **Persist then emit:** the socket handler validates the payload (Zod, same as
  every other wire contract), calls the `support` service to store the message,
  then emits to the room. Presence and typing indicators are ephemeral socket
  events — never persisted.
- **Offline handoff:** when no staff is connected, enqueue an email/SMS
  notification via `jobs/` (never inline) so the customer still gets a reply —
  same queued path as the rest of `notifications`.
- **Rate-limited:** quotas are keyed by the **authenticated user (or session)
  and conversation**, with IP-based limits where a caller is not yet
  authenticated — a client can open several authenticated sockets, so a
  per-connection quota alone is trivially evaded by reconnecting. Keep the
  per-connection limit as an additional burst guard, not as the limit.
- **One process:** sockets run in the same Express process as the API and jobs.
  If we ever scale sockets across processes we'll need the Socket.io Redis
  adapter — **ask before adding it** (budget rule).
- **PII:** never log message content — log conversation and message ids only.
- **Frontend:** the customer chat widget lives in `portal/features/support` and
  the staff view in `admin/features/support`; both use the shared
  `services/socket.ts` client, and message rendering follows Design.md.

---

## Code Style

- TypeScript strict, no `any`. The backend infers types from its Zod schemas;
  the frontend maintains its mirrors in `types/`.
- **Minimal comments — the code speaks.** Comment only a non-obvious *why*
  (money and crypto edge cases qualify).
- Naming: `PascalCase.tsx` components, `useThing.ts` hooks,
  `thing.service.ts` module files, kebab-case folders.

(Tailwind, design tokens, the component-class layer, and the overlay hook live
in **Design.md**.)

---

## Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`,
  `test:`.
- Commits are authored as **Umer Shabbir** — never as the AI. No AI co-author
  or attribution lines.

---

## Testing

Critical paths only — do not chase coverage.

- **Payments:** USDT matching + under/overpayment, money helpers, and a "runs
  twice, credits once" idempotency test. Manual settlement carries the same
  rule — two settlers on one wire must credit exactly once.
- **Auth:** guard checks per protected route group.
- Vitest colocated as `*.test.ts`; Playwright for the checkout e2e. Tron Nile
  testnet only; tests use a disposable docker-compose Postgres, never a real
  database.

---

## Security & PII

- Secrets never reach the browser — the frontend gets only `VITE_` vars. All
  secrets live in server env, validated in `config/env.ts` on boot; all external
  services are called from the backend only.
- Identity documents, addresses, tax IDs: R2 buckets are private; files are
  served only via short-TTL presigned URLs after an auth + ownership check in
  the **service layer**.
- Never log PII, card data, or webhook secrets — log record ids. Scrub PII in
  Sentry `beforeSend` in both apps.
- Pino via `lib/logger.ts`; no `console.log` in committed code. PostHog goes
  through the analytics wrapper and loads after consent on marketing pages.
- Email (SES + React Email) and SMS (Twilio) always send from a queued job,
  never inline in a request handler.

---

## Final Reminder

- Two apps, nothing shared — you are the sync mechanism between them.
- The backend defines the contract; the frontend mirrors it; both updated in
  the same task.
- Business logic lives in services; controllers and processors are adapters.
- Card payments are deferred — build nothing for them. Never invent marketing
  claims or legal advice.
- Design lives in **Design.md** — the Figma context is the pathway, not
  the spec; improve where warranted and log every deviation in the summary.
- End every task with the summary: what was built, what changed, how to test.
- You always need to kill any server that you start for yourself ok.