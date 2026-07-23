# AGENTS.md — Marty Global LLC

You are an expert full-stack TypeScript engineer building **Marty Global LLC**,
a corporate filing service provider. Clean, simple, maintainable code — clarity
over abstraction. Think like a senior engineer on a production SaaS.

Design, styling, and the UI build workflow live in **Design guide.md** (the
companion to this file). Everything else — architecture, backend, data, money,
auth, security — lives here.

---

## Project

Customers form and manage companies, file registrations, receive scanned mail,
get support, and pay — by card (Stripe) or USDT (TRC-20). Live chat, email/SMS
notifications, audit logging.

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
├── Design guide.md      # design system, Figma handling, UI build workflow
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
| UI | Tailwind + shadcn/ui |
| State | TanStack Query (server) + Zustand (client-only) |
| SEO | react-helmet-async (marketing meta tags) |
| Dates | date-fns — the only date library |
| ORM / DB | Prisma / PostgreSQL |
| Cache / Queue | Redis + BullMQ |
| Auth | Better Auth |
| Live chat | Socket.io |
| Email / SMS | Amazon SES (React Email) / Twilio |
| Payments | Stripe (Elements + Intents) · USDT TRC-20 via TronGrid |
| Bot protection | Cloudflare Turnstile (public forms) |
| Storage | Cloudflare R2 |
| Monitoring / Analytics | Sentry / PostHog |
| Testing | Vitest + Playwright |
| Deploy | Backend: Docker on a VPS · Frontend: static build (host TBD) |

This list is the budget. Never add a library without asking first.

---

## Workflow

Every task ends with a **short summary: what was built, what changed, how to
test it.**

- **UI / design / responsive tasks:** see **Design guide.md** — it owns the
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
├── marketing/    # public pages: home, services, pricing, about, contact, faq, legal
├── portal/       # customer portal: pages/ + features/
├── admin/        # admin portal: pages/ + features/
├── auth/         # sign-in/up screens + auth client (used by portal & admin)
├── components/   # cross-area UI; shadcn base in components/ui
├── services/     # api.ts, socket.ts, upload.ts, stripe.ts (publishable key only)
├── constants/    # local mirror: roles, statuses, plan catalog (backend = source of truth)
├── types/        # local mirror of API shapes
├── hooks/  stores/  lib/  styles/
├── assets/ 
```

- Route groups: `/` marketing (public) · `/app/*` portal (authenticated) ·
  `/admin/*` admin (staff/admin roles). Each area lazy-loads at the router;
  areas never import from each other.
- `pages/` = route screens that compose; `features/` = per-area domain logic
  (queries/mutations, feature components). `portal/features/payments` owns the
  branded checkout: Stripe Elements wrapper, saved cards, USDT screen.
- Marketing is **simple pages, no blog** — copy written directly in the page
  components; prices render from `constants/` only. A shared `<Seo>` component
  sets title/description/canonical/OG per page; sitemap + robots at build.
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
- The Stripe webhook is the one raw-body route — mount it before the JSON
  parser so signatures verify.
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
is the source of truth, storing the provider reference (PaymentIntent id /
Tron tx hash). Charging, webhooks, and reconciliation run in job processors,
never in request handlers; every state change is audited.

- **Card:** our branded checkout; Stripe Elements tokenizes client-side. Save
  via `SetupIntent`, attach to a Stripe `Customer`, persist brand/last4/expiry
  only. Charge off-session from a job (`off_session: true, confirm: true`),
  handling `requires_action`. Webhooks verify the raw-body signature and
  dedupe on the Stripe event id (unique constraint).
- **Never store a PAN or CVC** — no column, log, or endpoint, ever (PCI DSS;
  keeps us in SAQ A scope). If a task seems to need raw card data, stop — the
  answer is a Stripe token.
- **USDT:** a repeatable job polls TronGrid, verifies the real USDT contract
  address (fake tokens reuse the name), matches a pending `Payment` by
  address + amount, and credits only after required confirmations. Unique
  constraint on tx hash; match + credit in one DB transaction — never
  double-credit. **No private keys anywhere** — we watch transfers, we never
  sign or move funds.

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
- **Rate-limited:** inbound messages are rate-limited per connection, the same
  posture as public endpoints.
- **One process:** sockets run in the same Express process as the API and jobs.
  If we ever scale sockets across processes we'll need the Socket.io Redis
  adapter — **ask before adding it** (budget rule).
- **PII:** never log message content — log conversation and message ids only.
- **Frontend:** the customer chat widget lives in `portal/features/support` and
  the staff view in `admin/features/support`; both use the shared
  `services/socket.ts` client, and message rendering follows Design guide.md.

---

## Code Style

- TypeScript strict, no `any`. The backend infers types from its Zod schemas;
  the frontend maintains its mirrors in `types/`.
- **Minimal comments — the code speaks.** Comment only a non-obvious *why*
  (money and crypto edge cases qualify).
- Naming: `PascalCase.tsx` components, `useThing.ts` hooks,
  `thing.service.ts` module files, kebab-case folders.

(Tailwind + `cn()`/CVA, design tokens, shadcn, and Stripe-Elements card entry
live in **Design guide.md**.)

---

## Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`,
  `test:`.
- Commits are authored as **Umer Shabbir** — never as the AI. No AI co-author
  or attribution lines.

---

## Testing

Critical paths only — do not chase coverage.

- **Payments:** off-session charge flow, webhook dedupe, USDT matching +
  under/overpayment, money helpers, and a "runs twice, credits once"
  idempotency test.
- **Auth:** guard checks per protected route group.
- Vitest colocated as `*.test.ts`; Playwright for the checkout e2e. Stripe
  test mode + Tron Nile testnet only; tests use a disposable docker-compose
  Postgres, never a real database.

---

## Security & PII

- Secrets never reach the browser — the frontend gets only `VITE_` vars
  (Stripe publishable key). All secrets live in server env, validated in
  `config/env.ts` on boot; all external services are called from the backend
  only.
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
- Stripe holds the card, we hold the token. Never invent marketing claims or
  legal advice.
- Design lives in **Design guide.md** — the Figma context is the pathway, not
  the spec; improve where warranted and log every deviation in the summary.
- End every task with the summary: what was built, what changed, how to test.
- You always need to kill any server that you start for yourself ok.