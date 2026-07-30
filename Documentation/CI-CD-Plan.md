# CI/CD Plan — Marty Global LLC

GitHub Actions (CI + orchestration) · Cloudflare Pages (frontend) · Hetzner Cloud
(backend, Docker).

Companion to **Deployment-Plan.md**, which owns the servers, DNS, backups, and
runbooks. This file owns what runs on every push and how a commit becomes a
release.

> AGENTS.md says *"do not add CI workflows without asking."* This is the plan
> that answers that question. Nothing under `.github/` has been created yet —
> the YAML below is the proposal, not the implementation.

---

## 1. What is being shipped

Two independent apps in one repo (AGENTS.md: nothing shared, HTTP at runtime):

| App | Build output | Target | Deploy mechanism |
| --- | --- | --- | --- |
| `frontend/` | static `dist/` (Vite 8, React 19) | Cloudflare Pages | Direct Upload via `wrangler pages deploy` from Actions |
| `backend/` | Docker image (`node:24-alpine`, `dist/` + Prisma client) | Hetzner Cloud VM | GHCR image → SSH → `docker compose up -d` |

Backend is **one process**: Express API + Socket.io + BullMQ workers
(`src/server.ts`). There is no separate worker deploy, so there is one image and
one release unit.

**Repo facts the pipeline has to respect**

- 994 tracked files — 618 frontend, 278 backend.
- Node `>=24`, npm, TypeScript 7, both apps have their own lockfile.
- Backend: 28 Prisma migrations, 42 models, 28 Vitest files.
- Frontend: 3 Vitest files, `test:e2e` script exists but **no Playwright config
  and no e2e tests** — the checkout e2e is unbuilt.
- No ESLint/Prettier anywhere. There is no lint gate to wire up.
- Branches: `main` (default), `dev`. Remote `ttssoftwaress/Marty-Global-LLC`.

---

## 2. Blockers — must land before the first pipeline run

These are repo defects that CI/CD will otherwise ship. Ordered by severity.

| # | Problem | Where | Fix |
| --- | --- | --- | --- |
| B1 | **No `.dockerignore`.** `COPY . .` in the build stage copies `backend/.env` (Better Auth secret, DB URL, AWS + R2 keys, admin password) and local `node_modules` into an image layer. Secrets survive in the layer even though the final stage does not copy them forward. | `backend/Dockerfile:10` | Add `backend/.dockerignore`: `node_modules`, `.env*`, `dist`, `*.log`, `.git`. Treat any currently built image as compromised. |
| B2 | **Migrations cannot run from the production image.** `prisma` is a devDependency, and the production stage runs `npm ci --omit=dev` and never copies `prisma.config.ts`. `prisma migrate deploy` is impossible in that container — but Prisma 7 reads `DATABASE_URL` from `prisma.config.ts`, so the CLI needs it. | `backend/Dockerfile:17-22` | Add a third stage `FROM build AS migrate` (keeps devDeps + config) with `CMD ["npx","prisma","migrate","deploy"]`. Deploy runs that image as a one-shot container before the API starts. |
| B3 | **Cloudflare Pages will 404 every deep link.** React Router SPA with no `frontend/public/` directory and no `_redirects`. `/app/billing` on a hard refresh returns 404. | `frontend/` | Add `frontend/public/_redirects` → `/*  /index.html  200`. |
| B4 | **No security headers on the app that renders identity documents.** Helmet only covers API responses. Pages serves the SPA with no CSP/HSTS. | `frontend/` | Add `frontend/public/_headers` (CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`). Draft in Deployment-Plan §9. |
| B5 | **`TURNSTILE_SECRET_KEY` is not required in production.** `config/env.ts` lets it be blank, and `config/turnstile.ts` then logs a warning and passes every challenge — the public guest-chat and contact endpoints ship unprotected. | `backend/src/config/env.ts:163` | Extend the existing `superRefine` (the one enforcing SES in production) to require it. |
| B6 | **`sitemap.xml` / `robots.txt` absent.** AGENTS.md specifies "sitemap + robots at build". Marketing goes live unindexed/uncontrolled. | `frontend/` | Generate at build or check into `public/`. |
| B7 | **No e2e gate.** `test:e2e` runs Playwright against nothing. | `frontend/` | Either build the checkout e2e or remove the script — a green CI job that tests nothing is worse than no job. Plan assumes it lands in Phase 3. |

B1–B3 are hard blockers for the first deploy. B4–B6 are go-live blockers.
B7 is a Phase 3 gate.

---

## 3. Branching and environments

```
feature/*  ──PR──►  dev  ──PR──►  main  ──tag v*──►  production
                     │                                    │
                  staging                             production
              (auto on merge)                    (auto on tag, gated)
```

| Environment | Branch/ref | Frontend | Backend | Data |
| --- | --- | --- | --- | --- |
| **Preview** | any PR | Pages preview URL | *none* — points at staging API | staging DB |
| **Staging** | `dev` | `staging.martyglobal.com` | `api-staging.martyglobal.com` | own DB + Redis, `TRON_NETWORK=nile` |
| **Production** | tag `v*` on `main` | `martyglobal.com` | `api.martyglobal.com` | own DB + Redis, `TRON_NETWORK=mainnet` |

Rules:

- `main` and `dev` are protected: no direct pushes, PR + green CI required,
  linear history.
- **Production deploys from a tag, never from a branch push.** A tag is an
  explicit human decision and gives an immutable rollback target.
- GitHub **Environments** (`staging`, `production`) hold the secrets.
  `production` gets *required reviewers* — one approval before the deploy job
  runs.
- Preview builds must point at the **staging** API. A preview deployment gets a
  random `*.pages.dev` origin, which is a different registrable domain from
  `martyglobal.com` — session cookies will not be sent (see Deployment-Plan §4).
  Previews are for visual review of marketing/UI only; authenticated flows are
  verified on staging. Do not add `*.pages.dev` to `FRONTEND_ORIGIN`.

---

## 4. Workflows

Five files under `.github/workflows/`.

### 4.1 `ci.yml` — every push and PR

Path-filtered so a marketing copy change does not build a Docker image.

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [dev, main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  changes:
    runs-on: ubuntu-24.04
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:  ['backend/**', '.github/workflows/**']
            frontend: ['frontend/**', '.github/workflows/**']

  backend:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-24.04
    services:
      postgres:
        image: postgres:18-alpine
        env: { POSTGRES_USER: marty, POSTGRES_PASSWORD: marty, POSTGRES_DB: marty_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U marty" --health-interval 10s
          --health-timeout 5s --health-retries 5
      redis:
        image: redis:8-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping" --health-interval 10s
          --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgresql://marty:marty@localhost:5432/marty_test
      REDIS_URL: redis://localhost:6379
      NODE_ENV: test
      FRONTEND_ORIGIN: http://localhost:5173
      BETTER_AUTH_SECRET: ci-only-secret-at-least-32-characters-long
      BETTER_AUTH_URL: http://localhost:4000
      TRON_NETWORK: nile
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: backend/package-lock.json }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run typecheck
      - run: npx prisma migrate deploy          # migrations must apply cleanly
      - run: |                                   # schema.prisma == migrations
          npx prisma migrate diff \
            --from-schema-datasource prisma/schema.prisma \
            --to-schema-datamodel prisma/schema.prisma \
            --exit-code
      - run: npm test
      - run: npm audit --audit-level=high || true   # reported, not blocking (see §7)

  frontend:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-24.04
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
        env:
          VITE_API_URL: https://api-staging.martyglobal.com/v1
          VITE_AUTH_URL: https://api-staging.martyglobal.com
          VITE_SITE_URL: https://staging.martyglobal.com
      - uses: actions/upload-artifact@v4
        with: { name: frontend-dist, path: frontend/dist, retention-days: 7 }

  secrets-scan:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
```

Notes:

- **`prisma migrate diff --exit-code` is the drift gate.** AGENTS.md forbids
  hand-editing the database; this catches a `schema.prisma` edit that shipped
  without a migration, which is the exact failure that breaks a production
  `migrate deploy`.
- No lint job — there is no linter installed. Adding ESLint + Prettier is a
  stack-budget decision (AGENTS.md); recommended in Phase 3, needs approval.
- Backend tests today reuse whatever `DATABASE_URL` points at. The `services:`
  block above gives CI a disposable Postgres, which is what AGENTS.md's testing
  rule asks for; the same fix should be applied locally.

### 4.2 `deploy-frontend.yml`

Triggered by `push: dev` (staging) and `push: tags v*` (production).

```yaml
name: Deploy frontend
on:
  push:
    branches: [dev]
    paths: ['frontend/**', '.github/workflows/deploy-frontend.yml']
    tags: ['v*']

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-24.04
    environment: ${{ startsWith(github.ref, 'refs/tags/') && 'production' || 'staging' }}
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run build
        env:
          VITE_API_URL:            ${{ vars.VITE_API_URL }}
          VITE_AUTH_URL:           ${{ vars.VITE_AUTH_URL }}
          VITE_SITE_URL:           ${{ vars.VITE_SITE_URL }}
          VITE_TURNSTILE_SITE_KEY: ${{ vars.VITE_TURNSTILE_SITE_KEY }}
          VITE_SENTRY_DSN:         ${{ secrets.VITE_SENTRY_DSN }}
          VITE_SENTRY_ENVIRONMENT: ${{ vars.VITE_SENTRY_ENVIRONMENT }}
          VITE_SENTRY_RELEASE:     ${{ github.sha }}
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: frontend
          command: >-
            pages deploy dist --project-name=marty-global
            --branch=${{ startsWith(github.ref, 'refs/tags/') && 'main' || 'dev' }}
            --commit-dirty=true
```

**Why Actions + wrangler instead of the Cloudflare Git integration:**

1. All seven `VITE_*` vars are **compile-time** — the API origin is baked into
   the bundle. One build per environment, and the values must come from the same
   place as the backend's, or the two apps drift (AGENTS.md's sync rule).
2. `VITE_SENTRY_RELEASE` must be the commit SHA. Only the pipeline knows it.
3. The repo is a monorepo of two independent apps; path filtering and the
   backend gate live in Actions anyway.
4. Deploys can be ordered against the backend release (§5).

Turnstile site key and the browser Sentry DSN are public by design — GitHub
*variables*, not secrets. `CLOUDFLARE_API_TOKEN` is scoped to
`Cloudflare Pages: Edit` on one account, nothing else.

### 4.3 `deploy-backend.yml`

```yaml
name: Deploy backend
on:
  push:
    branches: [dev]
    paths: ['backend/**', '.github/workflows/deploy-backend.yml']
    tags: ['v*']

concurrency:
  group: backend-${{ startsWith(github.ref, 'refs/tags/') && 'production' || 'staging' }}
  cancel-in-progress: false

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-24.04-arm      # native arm64 — matches Hetzner CAX (Ampere)
    outputs: { image: ${{ steps.meta.outputs.tags }} }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/${{ github.repository }}/backend
          tags: |
            type=sha,format=long
            type=ref,event=tag
      - uses: docker/build-push-action@v6
        with:
          context: backend
          target: production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - uses: docker/build-push-action@v6      # the migrate stage (blocker B2)
        with:
          context: backend
          target: migrate
          push: true
          tags: ghcr.io/${{ github.repository }}/migrate:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-24.04
    environment: ${{ startsWith(github.ref, 'refs/tags/') && 'production' || 'staging' }}
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: deploy
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: /opt/marty/deploy.sh ${{ github.sha }}
```

The SSH key is **restricted at the server**, not trusted from the workflow —
`authorized_keys` pins `command="/opt/marty/deploy.sh",no-port-forwarding,no-pty`,
so a leaked Actions key can only run the deploy script with a SHA argument. It
cannot open a shell, read `.env`, or touch the database. `deploy.sh` and the
release sequence it performs are in Deployment-Plan §7.

### 4.4 `nightly.yml`

Runs at 03:00 UTC on `main`: `npm audit`, backup-verification ping (the restore
canary from Deployment-Plan §11 writes a heartbeat; this job fails if it is
stale), and a scheduled dependency review. Cheap, and it turns a silently broken
backup into a red build.

### 4.5 `codeql.yml`

GitHub CodeQL for `javascript-typescript`, weekly + on PR to `main`.

---

## 5. Release ordering — the two-app sync rule

AGENTS.md: the backend owns the contract, the frontend mirrors it, both change
in the same task. That makes deploy **order** part of correctness, because the
two artifacts go live through different systems at different speeds.

**Rule: backend first, frontend second, and every backend change is backward
compatible for one release.**

```
tag v1.4.0
  └─► deploy-backend  → migrate (expand only) → new API live, old contract still served
        └─► deploy-frontend (needs: backend) → new bundle live
```

Expand/contract for schema changes:

1. Release *N*: add the column/table/enum value, backfill, write to both shapes.
   Old frontend keeps working.
2. Release *N+1*: frontend uses the new shape.
3. Release *N+2*: drop the old shape.

A destructive migration in the same release as the frontend that needs it is the
one thing that turns a 30-second rollback into a restore-from-backup.

Add `needs: [deploy-backend]` between the two deploy workflows for tag builds
(via a single `release.yml` that calls both as reusable workflows) so the order
is enforced by the pipeline rather than by memory.

---

## 6. Secrets and variables matrix

**GitHub repo secrets** (org-level if reused):

| Name | Used by | Scope |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | frontend deploy | Pages: Edit, one account |
| `CLOUDFLARE_ACCOUNT_ID` | frontend deploy | — |
| `DEPLOY_HOST` / `DEPLOY_SSH_KEY` | backend deploy | per environment, command-restricted |
| `VITE_SENTRY_DSN` | frontend build | browser DSN (public, kept as a secret for tidiness) |

`GITHUB_TOKEN` covers GHCR — no PAT needed.

**GitHub environment variables** (non-secret, per environment): `VITE_API_URL`,
`VITE_AUTH_URL`, `VITE_SITE_URL`, `VITE_TURNSTILE_SITE_KEY`,
`VITE_SENTRY_ENVIRONMENT`.

**Never in GitHub:** every backend secret. `BETTER_AUTH_SECRET`, `DATABASE_URL`,
`AWS_*`, `R2_*`, `ADMIN_PASSWORD`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`,
`TRONGRID_API_KEY` live only in `/opt/marty/.env` on the Hetzner host (root:root,
`600`) — the pipeline never reads or writes them. `config/env.ts` fails the boot
loudly if one is missing, which is the detection mechanism.

Rotation: quarterly for `BETTER_AUTH_SECRET` (invalidates all sessions — do it in
a maintenance window), on-demand for the rest. `ADMIN_PASSWORD` is reconciled on
every boot (`admin-bootstrap.service.ts`), so rotating it is an env edit plus a
restart.

---

## 7. Gates — what blocks a merge or a deploy

| Gate | PR → `dev` | `dev` → staging | tag → production |
| --- | --- | --- | --- |
| typecheck (both apps) | block | block | block |
| Vitest (both apps) | block | block | block |
| `prisma migrate deploy` on a clean DB | block | block | block |
| migration drift (`migrate diff --exit-code`) | block | block | block |
| frontend production build | block | block | block |
| gitleaks | block | block | block |
| CodeQL | report | report | block on `high` |
| `npm audit --audit-level=high` | report | report | **block** |
| Playwright checkout e2e (Phase 3) | — | block | block |
| human approval | review | — | required reviewer |
| smoke test after deploy | — | auto-rollback | auto-rollback |

`npm audit` reports on PRs and blocks the production tag: a transitive advisory
should not stop a marketing copy change at 4pm, but it should stop a release.

---

## 8. Rollback

| Layer | Mechanism | Time |
| --- | --- | --- |
| Frontend | Cloudflare Pages → previous deployment → *Rollback*. Or re-run the workflow on the previous tag. | seconds |
| Backend (no migration) | `/opt/marty/deploy.sh <previous-sha>` — images are tagged by SHA and the last 5 are kept on the host. | ~30s |
| Backend (additive migration) | Same. The expand/contract rule means the previous image runs against the new schema. | ~30s |
| Backend (destructive migration) | Restore from the pre-migration backup (Deployment-Plan §11) + PITR. | 30–60 min |
| Total outage | Cloudflare Pages "maintenance" deployment + `docker compose stop api`. | minutes |

The pre-migration `pg_dump` in `deploy.sh` is what makes the third row survivable.
It is not optional.

---

## 9. Smoke test after deploy

Runs on the host at the end of `deploy.sh`, and again from Actions against the
public URL:

1. `GET https://api.../v1/health` → `{"data":{"status":"ok"}}` (retry 10× 3s).
2. `GET https://api.../v1/services` without a cookie → `401` with the
   `{ error: { code, message } }` envelope. Proves the default-deny in
   `routes.ts` survived the deploy.
3. `GET https://martyglobal.com/` → `200`, and `GET /app/billing` → `200` not
   `404`. Proves the SPA fallback (B3).
4. WebSocket upgrade to `wss://api.../socket.io/` returns `101`.
5. Sentry release marker created for the SHA.

Any failure → `deploy.sh` re-runs itself with the previous SHA and exits non-zero,
which fails the workflow.

---

## 10. Phasing

| Phase | Content | Gate to next |
| --- | --- | --- |
| **0 — Blockers** | B1–B3. `.dockerignore`, migrate stage, `_redirects`. | Image builds with no `.env` layer; `migrate deploy` runs from the migrate image. |
| **1 — CI only** | `ci.yml`, `codeql.yml`, gitleaks. Branch protection on `main`/`dev`. No deploys. | Green on `dev` for a week. |
| **2 — Staging CD** | Hetzner staging host, `deploy-backend.yml` + `deploy-frontend.yml` on `dev`. B4–B6 land here. | Ten consecutive clean staging deploys; one rehearsed rollback; one rehearsed DB restore. |
| **3 — Production CD** | Tag-driven, `production` environment with a required reviewer. Playwright e2e gate. Backups + monitoring verified first (Deployment-Plan §11–12). | — |
| **4 — Hardening** | Blue/green (zero-downtime), ESLint/Prettier gate, Grafana/Loki, quarterly restore drills. | — |

Do not skip Phase 2. The first production deploy should be the eleventh deploy
the pipeline has performed, not the first.

---

## 11. Open decisions

1. **ESLint + Prettier** — no linter exists. Adding one is a stack-budget item
   (AGENTS.md). Recommend yes, in Phase 4, `eslint` + `@typescript-eslint` +
   `prettier` as devDependencies in each app separately (nothing shared).
2. **Playwright e2e** — B7. The checkout e2e AGENTS.md asks for does not exist.
   Build it against Tron Nile on staging, or drop the script.
3. **`wrangler` as a devDependency vs `wrangler-action`** — plan uses the action
   (no new dependency in `frontend/package.json`). Confirm.
4. **Staging on its own Hetzner box vs a second compose stack on one box** —
   plan assumes a second stack on one box for cost; a separate CAX11 is ~€4/mo
   more and removes the noisy-neighbour risk to production Postgres. Recommend
   separate box once revenue starts.
5. **`ubuntu-24.04-arm` runner availability** on this account's plan. If it is
   not available, either build `linux/amd64` and use a Hetzner CPX (x86) or
   accept QEMU cross-build (~4× slower).
