# Marty Global LLC

Corporate filing service provider. Customers form and manage companies, file
registrations, receive scanned mail, get support, and pay by card (Stripe) or
USDT (TRC-20).

Marty Global is a filing service provider, not a law firm.

## Layout

```
corporate-filing-system/
├── AGENTS.md
├── frontend/            # React + Vite SPA
├── backend/             # Express API + jobs + Dockerfile
├── docker-compose.yml   # local Postgres + Redis
└── README.md
```

Two independent apps. Each has its own `package.json`, `node_modules`,
tsconfig, `.env`, and scripts — zip either folder and it builds alone. Nothing
is shared between them; their only connection is HTTP at runtime.

- `frontend/` — marketing site (`/`), customer portal (`/app`), admin portal
  (`/admin`)
- `backend/` — REST API, Socket.io live chat, and background jobs in one process

The backend is the source of truth for API shapes and the plan catalog. The
frontend keeps local mirrors in `src/types` and `src/constants`; when an
endpoint or the catalog changes, both apps are updated in the same task.

## Stack

| Layer | Technology |
| --- | --- |
| Core | PERN — PostgreSQL, Express, React, Node (TypeScript, npm) |
| Frontend | React + Vite + React Router |
| UI | Tailwind + shadcn/ui |
| State | TanStack Query (server) + Zustand (client-only) |
| ORM / DB | Prisma / PostgreSQL |
| Cache / Queue | Redis + BullMQ |
| Auth | Better Auth |
| Live chat | Socket.io |
| Email / SMS | Amazon SES (React Email) / Twilio |
| Payments | Stripe (Elements + Intents) · USDT TRC-20 via TronGrid |
| Storage | Cloudflare R2 |
| Monitoring | Sentry / PostHog |
| Testing | Vitest + Playwright |

## Requirements

- Node 24+
- npm
- Docker (local Postgres + Redis)

## Local setup

Start the databases from the repo root:

```bash
docker compose up -d
```

Backend — first terminal:

```bash
cd backend
npm install
cp .env.example .env      # fill in secrets; validated on boot by config/env.ts
npm run prisma:migrate
npm run db:seed
npm run dev
```

Frontend — second terminal:

```bash
cd frontend
npm install
cp .env.example .env      # VITE_ vars only (e.g. Stripe publishable key)
npm run dev
```

Dev is two terminals, `npm run dev` in each.

## Scripts

Backend:

| Script | Purpose |
| --- | --- |
| `npm run dev` | API + job workers, watch mode |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Types only, no emit |
| `npm test` | Vitest |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:deploy` | Apply migrations (deploy) |
| `npm run prisma:studio` | Prisma Studio |
| `npm run db:seed` | Seed the database |

Frontend:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Types only, no emit |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright (checkout e2e) |

## Environment

All secrets live in the backend, validated in `backend/src/config/env.ts` on
boot — the app fails fast if one is missing. The browser only ever receives
`VITE_` variables (the Stripe publishable key); every external service is
called from the backend.

## Testing

Critical paths only. Payments (off-session charge, webhook dedupe, USDT
matching and under/overpayment, money helpers, "runs twice, credits once") and
auth guards per protected route group. Stripe test mode and Tron Nile testnet
only; tests use a disposable docker-compose Postgres, never a real database.

## Deploy

Backend ships as a Docker image to a VPS:

```bash
cd backend
docker build -t marty-backend .
```

Frontend is a static build (`npm run build` → `dist/`); host TBD.
