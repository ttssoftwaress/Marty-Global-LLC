# Deployment Setup — Step by Step

The build order. Every account, every console setting, every command, in the
order they must happen, with a verification after each step.

Companion to **Deployment-Plan.md** (the *why* and the architecture) and
**CI-CD-Plan.md** (the pipeline). This file is the *do*.

> **Console UI paths drift.** Menu names below are accurate as of writing. If a
> label has moved, the setting still exists — search the provider's console for
> the setting name, not the path.

> **Do the whole thing on staging first, then repeat for production.** Every
> phase has a Staging / Production value column. The first production deploy
> should be the eleventh deploy the pipeline has done, not the first.

**Placeholders used throughout** — replace with your real values:

| Placeholder | Meaning | Example |
| --- | --- | --- |
| `martyglobal.com` | the apex domain | confirm before starting |
| `<HETZNER_IPV4>` / `<HETZNER_IPV6>` | server addresses | `5.161.x.x` |
| `<ADMIN_IP>` | your office/home IP for SSH | `203.0.113.7` |
| `ttssoftwaress/Marty-Global-LLC` | the GitHub repo | already correct |

---

## Contents

| Phase | What | Time | Blocks |
| --- | --- | --- | --- |
| [0](#phase-0--prerequisites) | Accounts, access, decisions | 30 min | everything |
| [1](#phase-1--fix-the-repo-blockers) | Repo blockers (7 fixes) | 2–3 h | any deploy |
| [2](#phase-2--domain--cloudflare-dns) | Domain + Cloudflare DNS | 30 min + propagation | 3,4,5,15 |
| [3](#phase-3--cloudflare-r2) | R2 buckets + tokens + CORS | 30 min | backend boot |
| [4](#phase-4--cloudflare-turnstile) | Turnstile widgets | 10 min | backend boot |
| [5](#phase-5--amazon-ses) | SES domain, DKIM, production access | 30 min + 24 h wait | go-live |
| [6](#phase-6--sentry) | Two projects, two DSNs | 15 min | — |
| [7](#phase-7--tron--trongrid) | TronGrid key + receiving address | 20 min | payments |
| [8](#phase-8--hetzner-server) | Server, firewall, volume, hardening | 1 h | backend |
| [9](#phase-9--the-server-stack) | `/opt/marty` files | 1 h | backend |
| [10](#phase-10--github-configuration) | Branch protection, environments, secrets | 30 min | CI/CD |
| [11](#phase-11--first-deploy-by-hand) | Bootstrap the backend manually | 30 min | Pages |
| [12](#phase-12--cloudflare-pages) | Pages project + custom domains | 30 min | go-live |
| [13](#phase-13--backups) | pgBackRest, Storage Box, canary | 2 h | production |
| [14](#phase-14--monitoring--alerting) | Uptime, Sentry alerts, thresholds | 45 min | production |
| [15](#phase-15--turn-the-pipeline-on) | Workflows, staging then production | 1 h | — |
| [16](#phase-16--verification) | End-to-end proof | 1 h | announce |
| [17](#phase-17--handover) | Credential inventory, rotation calendar | 30 min | — |

Total: roughly two working days spread over three calendar days (SES production
access and DNS propagation are the waits).

---

## Phase 0 — Prerequisites

### 0.1 Decisions to lock before touching a console

- [ ] **Domain confirmed.** Everything keys off it, and the cookie behaviour in
      Deployment-Plan §4 makes it load-bearing: the frontend and API *must* share
      a registrable domain or no one can stay signed in.
- [ ] **Subdomain scheme.** This plan uses:
      | | Staging | Production |
      | --- | --- | --- |
      | Frontend | `staging.martyglobal.com` | `martyglobal.com` + `www` |
      | Backend | `api-staging.martyglobal.com` | `api.martyglobal.com` |
- [ ] **Server arch.** arm64 (Hetzner CAX, cheaper) vs x86 (CPX). arm64 requires
      the `ubuntu-24.04-arm` GitHub runner — check availability on your plan
      first (Phase 10.5). Default: arm64.
- [ ] **Staging placement.** Same box, second compose project (cheaper) or its
      own CAX11 (~€4/mo, no noisy-neighbour risk to production Postgres). This
      guide assumes **same box**.
- [ ] **AWS region for SES.** `us-east-1` unless you have a reason. It must match
      `AWS_REGION` in the backend env.

### 0.2 Accounts to create

| Service | Plan | Payment card needed | Notes |
| --- | --- | --- | --- |
| Cloudflare | Free | for R2 | DNS + Pages + R2 + Turnstile, one account |
| Hetzner Cloud | pay-as-you-go | yes | ID verification can take hours — do this first |
| AWS | pay-as-you-go | yes | SES only |
| GitHub | existing | no | repo already exists |
| Sentry | Free/Developer | no | two projects |
| TronGrid | Free | no | read-only key |
| Twilio | — | — | **skip** — SMS is unbuilt (Phase 1.8) |

**Start the Hetzner account now.** Identity verification on a new account can
take several hours and it blocks Phase 8.

### 0.3 Local tooling

```bash
node --version      # >= 24
npm --version
docker --version    # for local verification only
ssh -V
git --version
```

### 0.4 Password manager

Create a shared vault entry per credential *before* generating any of them. Every
secret in this guide goes there at the moment it is created — a secret that
exists in only one place (the server) is one disk failure from an unrecoverable
deployment.

---

## Phase 1 — Fix the repo blockers

Seven fixes. The first three block any deploy at all; the rest block go-live.
Do these in a branch off `dev`, PR, merge.

### 1.1 `backend/.dockerignore` — **security critical**

Without it, `COPY . .` at [backend/Dockerfile:10](../backend/Dockerfile#L10) copies
`backend/.env` into a build layer: Better Auth secret, database URL, AWS keys, R2
keys, admin password. The final stage does not copy it forward, but the layer
still holds it and anyone who can pull the image can read it.

Create `backend/.dockerignore`:

```
node_modules
npm-debug.log
dist
.env
.env.*
*.log
.git
.gitignore
prisma/*.db
coverage
```

> If a backend image has already been built and pushed anywhere, treat every
> secret in `backend/.env` as compromised: rotate `BETTER_AUTH_SECRET`, the
> database password, the AWS key pair, the R2 token, and `ADMIN_PASSWORD`, then
> delete the image from the registry.

Verify:

```bash
cd backend
docker build --target build -t marty-check .
docker run --rm marty-check sh -c 'ls -a /app | grep -c "^\.env$" || echo "clean"'
# expect: clean
docker rmi marty-check
```

### 1.2 Dockerfile `migrate` stage

`prisma` is a devDependency and the production stage runs `npm ci --omit=dev`, so
`prisma migrate deploy` cannot run from it. Prisma 7 also reads `DATABASE_URL`
from `prisma.config.ts`, which the production stage never copies.

Append to `backend/Dockerfile` (keep the existing stages unchanged):

```dockerfile
# One-shot migration runner. Keeps devDependencies (the Prisma CLI) and
# prisma.config.ts, which is where Prisma 7 reads DATABASE_URL from.
# Deploy runs this to completion before starting the API.
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]
```

Also move the `COPY prisma ./prisma` line to include the config, so `generate`
in the build stage is not depending on `COPY . .` ordering:

```dockerfile
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate
```

Verify against the local dev database:

```bash
cd backend
docker build --target migrate -t marty-migrate .
docker run --rm --network host \
  -e DATABASE_URL=postgresql://marty:marty@localhost:5433/marty marty-migrate
# expect: "No pending migrations to apply." or the list it applied
```

### 1.3 `frontend/public/_redirects` — SPA fallback

There is no `frontend/public/` directory. Without it, Cloudflare Pages returns
404 for every deep link — `/app/billing` on a refresh, every emailed link, every
bookmark.

```bash
mkdir -p frontend/public
```

`frontend/public/_redirects`:

```
/*    /index.html   200
```

### 1.4 `frontend/public/_headers` — CSP and friends

Helmet only covers API responses. The SPA that renders scanned mail and identity
documents ships with no headers at all.

`frontend/public/_headers`:

```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.r2.cloudflarestorage.com; font-src 'self' data:; connect-src 'self' https://api.martyglobal.com wss://api.martyglobal.com https://*.ingest.sentry.io https://*.r2.cloudflarestorage.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'

/index.html
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

Two things that are not optional:

- `connect-src` must list the R2 host — uploads go **browser → R2** with a
  presigned PUT, not through the API.
- `frame-src` is the Turnstile widget.

Ship it as `Content-Security-Policy-Report-Only` first. Run staging for a week,
watch the browser console on every screen (portal, admin, marketing, upload,
chat), then rename the header to `Content-Security-Policy` to enforce.
`/index.html` must not be cached long or users stay pinned to a deleted asset
bundle after a deploy.

### 1.5 Require `TURNSTILE_SECRET_KEY` in production

`config/env.ts` currently allows it to be blank, and `config/turnstile.ts` then
logs a warning and passes every challenge. `/v1/guest-chat` and `/v1/contact` are
the two endpoints a bot can reach without a session.

In [backend/src/config/env.ts](../backend/src/config/env.ts), extend the existing
`superRefine` — the one that enforces the SES pair in production:

```ts
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    if (!value.AWS_ACCESS_KEY_ID || !value.AWS_SECRET_ACCESS_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['AWS_SECRET_ACCESS_KEY'],
        message:
          'NODE_ENV=production requires both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY',
      });
    }

    // The public write endpoints (guest chat, contact form) verify server-side.
    // Without the secret, config/turnstile.ts warns once and passes everything —
    // a spam queue with extra steps.
    if (!value.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['TURNSTILE_SECRET_KEY'],
        message: 'NODE_ENV=production requires TURNSTILE_SECRET_KEY',
      });
    }
  });
```

Add the same note to `backend/.env.example` above `TURNSTILE_SECRET_KEY`.

### 1.6 `sitemap.xml` + `robots.txt`

AGENTS.md specifies both at build. Simplest correct version — check them into
`frontend/public/` and update when a marketing route is added.

`frontend/public/robots.txt`:

```
User-agent: *
Allow: /$
Allow: /services
Allow: /how-it-works
Allow: /faq
Allow: /about
Allow: /contact
Allow: /legal
Disallow: /app/
Disallow: /admin/
Disallow: /sign-in
Disallow: /sign-up
Disallow: /reset-password

Sitemap: https://martyglobal.com/sitemap.xml
```

`frontend/public/sitemap.xml` — one `<url>` per public marketing route, matching
the routes in `frontend/src/app/router.tsx`. Confirm the list against the router
rather than assuming; a sitemap naming a 404 is worse than none.

**Staging must not be indexed.** Either serve a `Disallow: /` robots on the
staging build, or add `X-Robots-Tag: noindex` for `staging.martyglobal.com` in
`_headers`.

### 1.7 Decide the Playwright e2e

`frontend/package.json` has `test:e2e` and `@playwright/test`, but no config and
no tests. A gate that runs nothing is worse than no gate.

Either build the checkout e2e AGENTS.md asks for (Tron Nile only, against
staging), or delete the script and the dependency. Not a blocker for the first
deploy; it is a blocker for the Phase 3 production gate in CI-CD-Plan §10.

### 1.8 Two content/feature gaps that block *announcing*, not deploying

- **SMS is unbuilt.** No `config/twilio.ts`, no `TWILIO_*` env, no SMS job. The
  notification preferences UI at `/app/settings` offers an SMS channel that
  nothing sends on. Remove the channel from the UI, or build the sending half.
- **Marketing carries fabricated testimonials, statistics, and partner logos.**
  AGENTS.md forbids inventing them, and publishing them is a legal exposure for
  a filing service provider that is explicitly not a law firm. Remove before the
  site is public.

### 1.9 Merge

```bash
git checkout -b chore/deploy-blockers
# ... the changes above
git add -A
git commit -m "chore: deployment blockers — dockerignore, migrate stage, SPA fallback, headers, turnstile refine, robots/sitemap"
git push -u origin chore/deploy-blockers
gh pr create --base dev --title "Deployment blockers" --body "Phase 1 of Documentation/Deployment-Setup-Steps.md"
```

---

## Phase 2 — Domain + Cloudflare DNS

### 2.1 Add the site to Cloudflare

1. Cloudflare dashboard → **Add a site** → enter `martyglobal.com` → **Free**.
2. Cloudflare scans existing records. Review them; delete anything stale.
3. Copy the two assigned nameservers.
4. At the registrar, replace the nameservers with Cloudflare's.
5. Wait for Cloudflare to report **Active** (minutes to 24 h).

### 2.2 SSL/TLS settings

Cloudflare → **SSL/TLS**:

| Setting | Value | Why |
| --- | --- | --- |
| Encryption mode | **Full (strict)** | never Flexible — it would serve the app over http to the origin |
| Always Use HTTPS | On | |
| Minimum TLS Version | **TLS 1.2** | |
| Opportunistic Encryption | On | |
| TLS 1.3 | On | |
| Automatic HTTPS Rewrites | On | |
| HSTS | **leave off here** | set at Caddy and in `_headers`; enabling it in two places makes the preload state hard to reason about |

### 2.3 DNS records

Cloudflare → **DNS** → Records. The `api` records wait until Phase 8 gives you an
IP; add everything else now.

| Name | Type | Content | Proxy | TTL |
| --- | --- | --- | --- | --- |
| `@` | CNAME | `marty-global.pages.dev` | **Proxied** | Auto |
| `www` | CNAME | `marty-global.pages.dev` | **Proxied** | Auto |
| `staging` | CNAME | `marty-global.pages.dev` | **Proxied** | Auto |
| `api` | A | `<HETZNER_IPV4>` | **DNS only** | Auto |
| `api` | AAAA | `<HETZNER_IPV6>` | **DNS only** | Auto |
| `api-staging` | A | `<HETZNER_IPV4>` | **DNS only** | Auto |
| `api-staging` | AAAA | `<HETZNER_IPV6>` | **DNS only** | Auto |
| `@` | CAA | `0 issue "letsencrypt.org"` | — | Auto |

**`api` must be grey-cloud (DNS only).** `app.ts:21` sets `trust proxy 1`, which
is correct for exactly one proxy hop (Caddy). Adding the Cloudflare proxy makes
two hops, Express then resolves `req.ip` to a Cloudflare edge address, and every
caller on the internet shares a single `express-rate-limit` bucket. Changing this
later means changing that line in the same PR — see Deployment-Plan §4.

The Pages CNAME targets only resolve once the Pages project exists (Phase 12).
Adding them early is fine; they will error until then.

### 2.4 Email authentication records

Add the SPF and DMARC records now; the DKIM CNAMEs come from Phase 5.

| Name | Type | Content |
| --- | --- | --- |
| `@` | TXT | `v=spf1 include:amazonses.com -all` |
| `_dmarc` | TXT | `v=DMARC1; p=quarantine; rua=mailto:dmarc@martyglobal.com; fo=1` |

Start at `p=quarantine`. Move to `p=reject` after two weeks of clean aggregate
reports.

### 2.5 Verify

```bash
dig +short NS martyglobal.com
dig +short TXT martyglobal.com          # the SPF record
dig +short _dmarc.martyglobal.com TXT
dig +short CAA martyglobal.com
```

---

## Phase 3 — Cloudflare R2

Identity documents, mail scans, invoices. Private, always.

### 3.1 Enable R2 and create buckets

1. Cloudflare → **R2** → enable (requires a card; the free tier is generous).
2. **Create bucket**:
   - `marty-prod` — location: closest to your customers. **Note the jurisdiction
     if you pick one** (EU/FedRAMP) — a jurisdiction bucket is only reachable at
     `https://<account>.eu.r2.cloudflarestorage.com`, and the default hostname
     answers every request for it with a 403 that looks exactly like a bad key.
     If you choose one, you *must* set `R2_ENDPOINT`.
   - `marty-staging` — same settings.
   - `marty-backups` — for pgBackRest (Phase 13).
   - `marty-archive` — 7-year monthly dumps (Phase 13).
3. For `marty-prod` and `marty-staging`: **Settings** →
   - **Public access: disabled.** Do not connect an `r2.dev` domain and do not
     attach a custom domain. Files are served only through short-TTL presigned
     URLs after an auth + ownership check in the service layer.
   - **Object versioning: enabled** — a deleted or overwritten scan stays
     recoverable.
   - Lifecycle rule: delete noncurrent versions after **90 days**.
4. Copy the **Account ID** from the R2 overview sidebar → `R2_ACCOUNT_ID`.

### 3.2 Two API tokens — and why

R2 → **Manage API tokens** → **Create API token**.

| Token | Permission | Scope | Used by |
| --- | --- | --- | --- |
| `marty-prod-app` | **Object Read & Write** | bucket `marty-prod` only | the running backend (`.env`) |
| `marty-cors-admin` | **Admin Read & Write** | account | `npm run storage:cors`, once |

The CORS CLI needs bucket-level permissions the running service must not have —
`storage-cors.cli.ts` says so in its own error message. Create both, use the
admin one for one command, then discard it.

Record the S3 access key id and secret for `marty-prod-app`. **The secret is
shown once.**

### 3.3 Apply the bucket CORS policy

Uploads are browser → R2 direct, so every PUT is preflighted. A bucket with no
CORS rule answers that preflight with a 403 and the upload never leaves the
browser — nothing appears in the API log or the R2 log.

Run it once per bucket, from a machine with the backend checked out:

```bash
cd backend
cp .env .env.local-backup

# temporarily point at the ADMIN token and the production origins
cat > .env.cors <<'EOF'
NODE_ENV=production
FRONTEND_ORIGIN=https://martyglobal.com,https://www.martyglobal.com
DATABASE_URL=postgresql://x:x@localhost:5432/x
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=only-for-this-one-command-32-chars-min
BETTER_AUTH_URL=https://api.martyglobal.com
AWS_ACCESS_KEY_ID=placeholder
AWS_SECRET_ACCESS_KEY=placeholder
TURNSTILE_SECRET_KEY=placeholder
R2_ACCOUNT_ID=<account id>
R2_ACCESS_KEY_ID=<marty-cors-admin key>
R2_SECRET_ACCESS_KEY=<marty-cors-admin secret>
R2_BUCKET=marty-prod
EOF

node --env-file=.env.cors ./node_modules/tsx/dist/cli.mjs src/lib/storage-cors.cli.ts
rm .env.cors
```

Expect: `Applied bucket CORS policy` with the rule set logged.

Repeat with `R2_BUCKET=marty-staging` and
`FRONTEND_ORIGIN=https://staging.martyglobal.com`.

**Re-run this whenever `FRONTEND_ORIGIN` changes.** Applying is a full
replacement of the rule set, so pass every origin that must reach the bucket.
Extra origins can be added as arguments: `npm run storage:cors -- https://other.example`.

### 3.4 Values recorded

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
and `R2_ENDPOINT` *only if the bucket has a jurisdiction*. All four of the first
group must be set together — the env schema refuses a half-filled block on boot.

---

## Phase 4 — Cloudflare Turnstile

Guards `/v1/guest-chat/sessions` and `/v1/contact` — the only two endpoints
reachable without a session.

1. Cloudflare → **Turnstile** → **Add site**.
2. Production widget:
   - Name: `marty-global-production`
   - Domains: `martyglobal.com`, `www.martyglobal.com`
   - Widget mode: **Managed**
3. Staging widget: name `marty-global-staging`, domain `staging.martyglobal.com`.
4. Record for each: **Site Key** (public → `VITE_TURNSTILE_SITE_KEY`) and
   **Secret Key** (→ `TURNSTILE_SECRET_KEY`).

The two are issued together and must stay paired per environment. After Phase
1.5 the backend refuses to boot in production without the secret.

---

## Phase 5 — Amazon SES

Password resets, verification emails, payment receipts, the offline chat handoff.
**Start this early** — production access is a manual review.

### 5.1 Verify the domain

1. AWS Console → **SES** → confirm the region matches your intended `AWS_REGION`
   (this guide: `us-east-1`).
2. **Verified identities** → **Create identity** → **Domain** →
   `martyglobal.com`.
3. Enable **Easy DKIM**, RSA 2048.
4. AWS shows three CNAME records. Add all three in Cloudflare DNS
   (**DNS only**, not proxied).
5. Wait for the identity to read **Verified** (minutes to a few hours).

### 5.2 Custom MAIL FROM

Improves DMARC alignment.

1. On the identity → **Custom MAIL FROM domain** → `mail.martyglobal.com`.
2. Add the MX and TXT records AWS gives you, in Cloudflare, **DNS only**.
3. Behaviour on MX failure: **Reject message** (fail loudly rather than send
   unaligned).

### 5.3 Configuration set + bounce handling

1. SES → **Configuration sets** → **Create** → `marty-default`.
2. **Event destinations** → add an SNS destination for **Bounce**, **Complaint**,
   **Delivery Delay**. Subscribe an ops email to the SNS topic.
3. Record the name → `SES_CONFIGURATION_SET=marty-default`.

A bounce rate over 5% or a complaint rate over 0.1% gets the account suspended.
This is the early warning.

### 5.4 Request production access

**The sandbox only delivers to individually verified addresses.** Without this,
password resets and receipts silently fail for real customers while looking fine
in the logs.

SES → **Account dashboard** → **Request production access**:

- Mail type: **Transactional**
- Website: `https://martyglobal.com`
- Use case: describe the actual sends — account verification, password resets,
  order status notifications, payment receipts, support chat handoff. State that
  all mail is triggered by a user action, there is no marketing list, and
  bounces/complaints are monitored via SNS.
- Expected volume: be honest and conservative.

Turnaround is usually under 24 hours. **Go-live blocker.**

### 5.5 IAM user for the app

1. IAM → **Users** → **Create user** → `marty-ses-sender`. No console access.
2. Attach an inline policy — nothing broader:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["ses:SendEmail", "ses:SendRawEmail"],
    "Resource": "*",
    "Condition": {
      "StringEquals": { "ses:FromAddress": "no-reply@martyglobal.com" }
    }
  }]
}
```

3. **Security credentials** → **Create access key** → *Application running
   outside AWS*. Record both halves.

### 5.6 Verify

```bash
dig +short CNAME <selector1>._domainkey.martyglobal.com
aws ses get-account --region us-east-1        # ProductionAccessEnabled: true
```

Values recorded: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`SES_FROM_EMAIL=no-reply@martyglobal.com`, `SES_FROM_NAME=Marty Global`,
`SES_REPLY_TO_EMAIL=support@martyglobal.com`, `SES_CONFIGURATION_SET=marty-default`.

---

## Phase 6 — Sentry

Two projects, because browser and server errors must stay apart.

1. sentry.io → **Create project** → platform **Node.js** → `marty-backend`.
   Copy the DSN → `SENTRY_DSN`.
2. **Create project** → platform **React** → `marty-frontend`.
   Copy the DSN → `VITE_SENTRY_DSN`.
3. Per project → **Settings**:
   - **Data Scrubbing**: on. **Scrub IP addresses**: on.
   - Additional sensitive fields: `password`, `token`, `secret`, `authorization`,
     `cookie`, `taxId`, `ssn`, `address`, `dateOfBirth`.
   - The apps already scrub in `beforeSend` (`backend/src/config/sentry.ts`,
     `frontend/src/lib/sentry.ts`); this is defence in depth.
   - **Session Replay: off** on the frontend project. These screens show identity
     documents and scanned mail.
4. **Alerts** → new rule: *a new issue is created* → email + Slack. Second rule:
   *an issue changes state from resolved to regressed*.

`AppError` is already excluded from reporting in `app.ts`, so routine 4xx will
not drown the signal.

Values: `SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`,
`SENTRY_TRACES_SAMPLE_RATE=0.1`, `VITE_SENTRY_ENVIRONMENT=production`.

---

## Phase 7 — Tron / TronGrid

The backend only **watches** the chain. No private key belongs on the server, in
the repo, in an env file, or in a backup.

### 7.1 TronGrid API key

1. trongrid.io → sign up → **Dashboard** → **API Keys** → create.
2. Record → `TRONGRID_API_KEY`.

### 7.2 Receiving address

1. Create the receiving address in TronLink (or a hardware wallet).
2. Record the **public** address, base58, `T` + 33 characters →
   `TRON_DEPOSIT_ADDRESS`.
3. **The private key / seed phrase goes to offline business custody.** It is
   never entered anywhere in this deployment. `config/env.ts` has no field for
   it, by design.
4. Staging uses **Nile testnet** (`TRON_NETWORK=nile`) with a testnet address.
   Faucet: `https://nileex.io/join/getJoinPage`.

### 7.3 Settings

| Variable | Staging | Production |
| --- | --- | --- |
| `TRON_NETWORK` | `nile` | `mainnet` |
| `TRON_MIN_CONFIRMATIONS` | `19` | `19` |
| `TRON_POLL_INTERVAL_SECONDS` | `30` | `30` |
| `USDT_USD_RATE_MINOR` | `1000000` | business decision — integer over 1_000_000, never a float |
| `USDT_RATE_TTL_MINUTES` | `30` | `30` |

`TRON_NETWORK=mainnet` refuses to boot without both the address and the API key.

---

## Phase 8 — Hetzner server

### 8.1 Project and SSH key

1. Hetzner Cloud Console → **New project** → `marty-global`.
2. Generate a deploy keypair locally (this is the admin key, not the CI key):
   ```bash
   ssh-keygen -t ed25519 -C "marty-admin" -f ~/.ssh/marty_admin
   ```
3. **Security** → **SSH Keys** → add `~/.ssh/marty_admin.pub`.

### 8.2 Firewall — create before the server

**Security** → **Firewalls** → **Create firewall** → `marty-web`.

Inbound:

| Port | Protocol | Source | Purpose |
| --- | --- | --- | --- |
| 22 | TCP | `<ADMIN_IP>/32` | SSH — your IP only |
| 80 | TCP | `0.0.0.0/0`, `::/0` | ACME HTTP-01 + redirect |
| 443 | TCP | `0.0.0.0/0`, `::/0` | API + WebSocket |

Outbound: allow all.

**5432 and 6379 are never opened.** In the production compose file Postgres and
Redis get no `ports:` mapping at all — only the internal Docker network. (The
repo's dev `docker-compose.yml` publishes 5433/6379; that file is for local
development and is not what runs in production.)

If your IP is dynamic, use a `/24` you control or put SSH behind Tailscale.

### 8.3 Volume

**Volumes** → **Create volume**:

- Name `marty-pgdata`, size **40 GB**, same location as the server.
- Format **ext4**, mount point `/mnt/marty-pgdata`.

Separating the database from the boot disk means it survives a server rebuild
and can be snapshotted independently.

### 8.4 Server

**Servers** → **Create server**:

| Setting | Value |
| --- | --- |
| Location | closest to customers (e.g. Ashburn / Falkenstein) |
| Image | **Ubuntu 24.04** |
| Type | **CAX31** (8 vCPU arm64, 16 GB, 160 GB) — or **CPX31** for x86 |
| Volume | attach `marty-pgdata` |
| Firewall | `marty-web` |
| SSH key | `marty-admin` |
| IPv4 + IPv6 | both |
| Backups | optional — this is *not* the database backup (Phase 13) |
| Name | `marty-prod-1` |

Record the IPv4 and IPv6 → go back and fill in the `api` / `api-staging` DNS
records from Phase 2.3.

### 8.5 Harden

```bash
ssh -i ~/.ssh/marty_admin root@<HETZNER_IPV4>
```

```bash
# --- packages -------------------------------------------------------------
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades \
               rclone age postgresql-client-18

# --- docker engine + compose plugin (official repo, not the distro package)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# --- deploy user ----------------------------------------------------------
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

# --- ssh ------------------------------------------------------------------
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/'     /etc/ssh/sshd_config
systemctl restart ssh

# --- automatic security updates ------------------------------------------
dpkg-reconfigure -plow unattended-upgrades
systemctl enable --now unattended-upgrades

# --- fail2ban -------------------------------------------------------------
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
maxretry = 3
bantime = 3600
findtime = 600
EOF
systemctl enable --now fail2ban

# --- swap: a build or a pg_dump must never OOM-kill the API --------------
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' >> /etc/sysctl.d/99-marty.conf

# --- time: USDT rate TTLs and session expiry are time-derived ------------
timedatectl set-ntp true && timedatectl

# --- database volume ------------------------------------------------------
mkdir -p /var/lib/marty/postgres
# confirm the Hetzner volume mount, then bind it:
lsblk
echo "/mnt/marty-pgdata /var/lib/marty none bind 0 0" >> /etc/fstab
mount -a
df -h /var/lib/marty

# --- docker log rotation (belt and braces; compose sets it per service) ---
cat > /etc/docker/daemon.json <<'EOF'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
EOF
systemctl restart docker
```

### 8.6 Verify

```bash
docker run --rm hello-world
free -h | grep Swap
ufw status || echo "using the Hetzner cloud firewall"
ss -tlnp                      # nothing on 5432/6379 yet, and nothing unexpected
```

---

## Phase 9 — The server stack

Everything lives in `/opt/marty`. As `root`:

```bash
mkdir -p /opt/marty/{secrets,backup,releases}
mkdir -p /var/backups/marty
chown -R deploy:deploy /opt/marty/releases
```

### 9.1 `/opt/marty/secrets/pg_password`

```bash
openssl rand -base64 32 | tr -d '\n' > /opt/marty/secrets/pg_password
chmod 600 /opt/marty/secrets/pg_password
```

Record it in the password manager. It is half of `DATABASE_URL`.

### 9.2 `/opt/marty/.env`

Every backend secret. `config/env.ts` validates on boot and exits 1 naming the
missing field (never the value).

```bash
cat > /opt/marty/.env <<'EOF'
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# Exact-origin allowlist, no wildcards. THE FIRST ENTRY IS THE CANONICAL URL
# used to build every outbound email link (publicAppUrl) — apex first, not www.
FRONTEND_ORIGIN=https://martyglobal.com,https://www.martyglobal.com

DATABASE_URL=postgresql://marty:<PG_PASSWORD>@postgres:5432/marty
REDIS_URL=redis://redis:6379

BETTER_AUTH_SECRET=<npx @better-auth/cli secret>
BETTER_AUTH_URL=https://api.martyglobal.com

ADMIN_EMAIL=admin@martyglobal.com
ADMIN_PASSWORD=<strong, 8-128 chars>
ADMIN_NAME=Marty Global Admin

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from Phase 5.5>
AWS_SECRET_ACCESS_KEY=<from Phase 5.5>
SES_FROM_EMAIL=no-reply@martyglobal.com
SES_FROM_NAME=Marty Global
SES_REPLY_TO_EMAIL=support@martyglobal.com
SES_CONFIGURATION_SET=marty-default

R2_ACCOUNT_ID=<Phase 3>
R2_ACCESS_KEY_ID=<marty-prod-app>
R2_SECRET_ACCESS_KEY=<marty-prod-app>
R2_BUCKET=marty-prod
# R2_ENDPOINT=   # ONLY if the bucket has a jurisdiction (EU/FedRAMP)
R2_REGION=auto
R2_PRESIGNED_URL_TTL_SECONDS=300

SENTRY_DSN=<backend project DSN>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

SUPPORT_HANDOFF_DELAY_MINUTES=5
SUPPORT_SOCKET_MESSAGES_PER_MINUTE=60
GUEST_CHAT_RETENTION_DAYS=7
GUEST_CHAT_PURGE_INTERVAL_SECONDS=86400

TURNSTILE_SECRET_KEY=<Phase 4>

TRON_NETWORK=mainnet
TRONGRID_API_KEY=<Phase 7>
TRON_DEPOSIT_ADDRESS=<public receiving address>
TRON_MIN_CONFIRMATIONS=19
TRON_POLL_INTERVAL_SECONDS=30
USDT_USD_RATE_MINOR=1000000
USDT_RATE_TTL_MINUTES=30
EOF

chown root:root /opt/marty/.env
chmod 600 /opt/marty/.env
```

Generate the auth secret on your laptop, not the server:

```bash
cd backend && npx @better-auth/cli secret
```

`ADMIN_PASSWORD` is re-applied to the admin account on **every boot**
(`admin-bootstrap.service.ts`). Rotating it is an edit here plus a restart.

The `deploy` user must not be able to read this file — that is why the deploy SSH
key is `command=`-restricted (9.6).

### 9.3 `/opt/marty/docker-compose.yml`

```yaml
name: marty

services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ['80:80', '443:443']
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on: [api]
    logging:
      driver: json-file
      options: { max-size: '10m', max-file: '5' }

  api:
    image: ghcr.io/ttssoftwaress/marty-global-llc/backend:${IMAGE_TAG}
    restart: unless-stopped
    env_file: [.env]
    environment:
      SENTRY_RELEASE: ${IMAGE_TAG}
    expose: ['4000']
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    healthcheck:
      test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:4000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 40s
    logging:
      driver: json-file
      options: { max-size: '10m', max-file: '5' }
    deploy:
      resources:
        limits: { memory: 2g }

  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: marty
      POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
      POSTGRES_DB: marty
    volumes:
      - /var/lib/marty/postgres:/var/lib/postgresql/data
      - ./backup:/etc/pgbackrest:ro
    command: >-
      postgres
        -c wal_level=replica
        -c archive_mode=on
        -c archive_timeout=300
        -c archive_command='pgbackrest --stanza=marty archive-push %p'
        -c max_wal_size=2GB
        -c shared_buffers=4GB
        -c effective_cache_size=10GB
        -c work_mem=32MB
        -c maintenance_work_mem=512MB
        -c log_min_duration_statement=500
        -c log_connections=off
    secrets: [pg_password]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U marty -d marty']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: >-
      redis-server --appendonly yes --appendfsync everysec
                   --maxmemory 512mb --maxmemory-policy noeviction
    volumes: [redis-data:/data]
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

secrets:
  pg_password:
    file: ./secrets/pg_password

volumes:
  redis-data:
  caddy-data:
  caddy-config:
```

Three settings that are not cosmetic:

- **`SENTRY_RELEASE: ${IMAGE_TAG}` on `api`.** An `environment:` entry, not a
  line in `.env`: the value changes on every deploy while `.env` is static.
  `IMAGE_TAG` is the variable `deploy.sh` already exports when swapping the API
  container (9.5), so nothing extra has to be plumbed for it.
- **`--maxmemory-policy noeviction`.** Redis holds BullMQ jobs *and* the
  rate-limit store. An LRU policy would silently evict queued notification
  emails and payment-reconciliation jobs under pressure. Failing loudly is
  correct.
- **`--appendonly yes`.** Losing the queue means unsent verification emails and
  a paused guest-chat purge schedule. The dev compose has no persistence flags.

`archive_timeout=300` is what caps the backup RPO at 5 minutes.

### 9.4 `/opt/marty/Caddyfile`

```
{
	email ops@martyglobal.com
}

api.martyglobal.com {
	encode zstd gzip

	# reverse_proxy handles the Socket.io WebSocket upgrade transparently.
	reverse_proxy api:4000 {
		# OVERWRITE, not append: a client-supplied X-Forwarded-For must not be
		# able to prepend a fake address and slip past express-rate-limit.
		# Exactly one hop, which is what app.ts's `trust proxy 1` expects.
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
		header_up Host {host}
	}

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		-Server
	}

	log {
		output file /data/access.log {
			roll_size 20mb
			roll_keep 5
		}
		format json
	}
}

api-staging.martyglobal.com {
	encode zstd gzip
	reverse_proxy api-staging:4000 {
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

Caddy obtains and renews Let's Encrypt certificates automatically over HTTP-01,
which is why port 80 is open in the firewall.

Check the access log format does not capture query strings — presigned R2 URLs
carry their signature there.

### 9.5 `/opt/marty/deploy.sh`

```bash
cat > /opt/marty/deploy.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

SHA="${1:-}"
# When invoked through the restricted SSH key, the argument arrives in
# SSH_ORIGINAL_COMMAND rather than $1.
[ -z "$SHA" ] && SHA="${SSH_ORIGINAL_COMMAND:-}"
SHA="$(printf '%s' "$SHA" | tr -cd '[:alnum:].-')"
[ -z "$SHA" ] && { echo "usage: deploy.sh <sha|tag>"; exit 2; }

cd /opt/marty
REPO=ghcr.io/ttssoftwaress/marty-global-llc
PREV="$(cat releases/current 2>/dev/null || echo none)"
echo "==> deploy ${PREV} -> ${SHA}"

# 1. Pull both images BEFORE touching anything. A registry failure must not
#    take down a healthy API.
docker pull "${REPO}/backend:${SHA}"
docker pull "${REPO}/migrate:${SHA}"

# 2. Pre-migration backup. This is the rollback path for a destructive
#    migration, and it is not optional.
docker compose exec -T postgres pg_dump -U marty -Fc marty \
  > "/var/backups/marty/pre-deploy-${SHA}.dump"
pg_restore --list "/var/backups/marty/pre-deploy-${SHA}.dump" > /dev/null
pgbackrest --stanza=marty --type=incr backup || echo "WARN: incremental backup failed"

# 3. Migrations, as a one-shot container.
docker run --rm --network marty_default --env-file .env "${REPO}/migrate:${SHA}"

# 4. Swap the API container.
IMAGE_TAG="${SHA}" docker compose up -d --no-deps api

# 5. Smoke test.
ok=0
for _ in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:4000/v1/health | grep -q '"status":"ok"'; then ok=1; break; fi
  sleep 3
done
# Default-deny must have survived the deploy: an unauthenticated read is 401.
code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/v1/services)"
[ "$code" = "401" ] || ok=0

if [ "$ok" = "1" ]; then
  echo "${SHA}" > releases/current
  docker image prune -f --filter "until=720h"
  echo "==> deployed ${SHA}"
else
  echo "==> smoke test FAILED — rolling back to ${PREV}"
  [ "$PREV" != "none" ] && IMAGE_TAG="${PREV}" docker compose up -d --no-deps api
  exit 1
fi
SCRIPT

chmod 750 /opt/marty/deploy.sh
chown root:deploy /opt/marty/deploy.sh
```

`--no-deps api` recreates only the API — Postgres, Redis, and Caddy keep running.
Expect ~10–20 s of 502s per deploy; Socket.io clients reconnect on their own.
Zero-downtime blue/green is the Phase 4 upgrade in Deployment-Plan §14.

### 9.6 The CI deploy key — restricted

Generate on your laptop:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/marty_ci -N ""
```

On the server:

```bash
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
cat >> /home/deploy/.ssh/authorized_keys <<'EOF'
command="/opt/marty/deploy.sh",no-agent-forwarding,no-port-forwarding,no-pty,no-X11-forwarding,no-user-rc ssh-ed25519 AAAA...<marty_ci.pub> github-actions-deploy
EOF
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

This is what makes a leaked CI key survivable: it can run a deploy with a SHA and
nothing else — no shell, no reading `/opt/marty/.env`, no `psql`.

The **private** key (`~/.ssh/marty_ci`) goes into the GitHub secret
`DEPLOY_SSH_KEY` (Phase 10) and the password manager. Nowhere else.

### 9.7 GHCR pull access on the host

```bash
# a GitHub PAT with read:packages ONLY
echo "<PAT>" | docker login ghcr.io -u <github-username> --password-stdin
```

Credentials land in `/root/.docker/config.json`. Repeat as the `deploy` user if
`deploy.sh` ever runs unprivileged.

---

## Phase 10 — GitHub configuration

### 10.1 Branch protection

**Settings** → **Branches** → add a rule for `main`, then the same for `dev`:

- [x] Require a pull request before merging (1 approval on `main`)
- [x] Require status checks to pass: `backend`, `frontend`, `secrets-scan`
- [x] Require branches to be up to date before merging
- [x] Require linear history
- [x] Do not allow bypassing the above settings
- [ ] Allow force pushes — **off**
- [ ] Allow deletions — **off**

### 10.2 Environments

**Settings** → **Environments** → **New environment**.

**`staging`** — no protection rules. Deployment branches: `dev` only.

**`production`**:

- [x] **Required reviewers** — yourself (and one other if there is a team)
- [x] Wait timer: 0
- Deployment branches and tags: **Selected** → tag pattern `v*`

### 10.3 Secrets

**Settings** → **Secrets and variables** → **Actions** → **Secrets**.

Repository-level:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Phase 12.1 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar |

Per environment (`staging` and `production` each get their own):

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | `<HETZNER_IPV4>` |
| `DEPLOY_SSH_KEY` | contents of `~/.ssh/marty_ci` (the private key, full file including header/footer) |
| `VITE_SENTRY_DSN` | the **frontend** project DSN |

**Never in GitHub:** `BETTER_AUTH_SECRET`, `DATABASE_URL`, `AWS_*`, `R2_*`,
`ADMIN_PASSWORD`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN` (backend),
`TRONGRID_API_KEY`. Those live only in `/opt/marty/.env`. The pipeline never
reads or writes them, and `config/env.ts` failing the boot is the detection
mechanism if one goes missing.

### 10.4 Variables

Same page → **Variables** tab, per environment.

| Variable | staging | production |
| --- | --- | --- |
| `VITE_API_URL` | `https://api-staging.martyglobal.com/v1` | `https://api.martyglobal.com/v1` |
| `VITE_AUTH_URL` | `https://api-staging.martyglobal.com` | `https://api.martyglobal.com` |
| `VITE_SITE_URL` | `https://staging.martyglobal.com` | `https://martyglobal.com` |
| `VITE_TURNSTILE_SITE_KEY` | staging site key | production site key |
| `VITE_SENTRY_ENVIRONMENT` | `staging` | `production` |

All seven `VITE_*` are **compile-time** — baked into the bundle. One build per
environment; changing one means a rebuild, not a restart.

### 10.5 Actions and packages

- **Settings** → **Actions** → **General** → Workflow permissions:
  **Read repository contents and packages permissions**, and allow
  `GITHUB_TOKEN` to write packages (the deploy workflow declares
  `packages: write` per job).
- Confirm `ubuntu-24.04-arm` runners are available on your plan. If not, either
  switch the server to a CPX (x86) type or accept QEMU cross-builds (~4× slower).
- **Settings** → **Code security** → enable Dependabot alerts, Dependabot
  security updates, and secret scanning with push protection.

---

## Phase 11 — First deploy by hand

Bootstrap the backend once manually, before wiring the pipeline. This proves the
stack in isolation, so a later failure is unambiguously a pipeline failure.

### 11.1 Build and push the images from your laptop

```bash
cd backend
echo "<GHCR PAT>" | docker login ghcr.io -u <username> --password-stdin

SHA=$(git rev-parse HEAD)
REPO=ghcr.io/ttssoftwaress/marty-global-llc

docker buildx build --platform linux/arm64 --target production \
  -t "$REPO/backend:$SHA" --push .
docker buildx build --platform linux/arm64 --target migrate \
  -t "$REPO/migrate:$SHA" --push .
```

Use `--platform linux/amd64` for a CPX server.

### 11.2 Start the data services

```bash
ssh root@<HETZNER_IPV4>
cd /opt/marty
docker compose up -d postgres redis
docker compose ps            # both healthy before continuing
```

### 11.3 Migrate

```bash
docker run --rm --network marty_default --env-file .env \
  ghcr.io/ttssoftwaress/marty-global-llc/migrate:<SHA>
```

Expect all 28 migrations to apply. If it fails on `prisma.config.ts` not being
found, Phase 1.2 was not applied.

**Do not run `db:seed`, `db:scaffold`, or `db:setup` against production** — they
insert demo customers, demo orders, and demo pricing. Reference data (locations,
mail carriers) is admin-managed at `/admin/settings`, never seeded.
`db:reset` refuses to run with `NODE_ENV=production` unless forced; leave it that
way.

### 11.4 Start the API and Caddy

```bash
IMAGE_TAG=<SHA> docker compose up -d
docker compose logs -f api
```

Watch for, in order: the env validation passing silently, the admin bootstrap,
the guest-chat purge schedule, and `API listening on http://localhost:4000`.

If the process exits 1 immediately, read the fatal line — it names the missing
or invalid env field (never the value).

### 11.5 Verify

```bash
# on the server
curl -s http://127.0.0.1:4000/v1/health
# {"data":{"status":"ok"}}

# from your laptop — TLS, DNS, and Caddy all at once
curl -s https://api.martyglobal.com/v1/health
curl -s -o /dev/null -w '%{http_code}\n' https://api.martyglobal.com/v1/services   # 401
curl -sI https://api.martyglobal.com/v1/health | grep -i strict-transport

# WebSocket upgrade reaches Socket.io
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://api.martyglobal.com/socket.io/?EIO=4&transport=polling"                 # 200
```

Then record the release and hand the box to the pipeline:

```bash
echo "<SHA>" > /opt/marty/releases/current
```

---

## Phase 12 — Cloudflare Pages

### 12.1 API token for CI

Cloudflare → **My Profile** → **API Tokens** → **Create Token** → **Custom**:

| Permission | Scope |
| --- | --- |
| Account · Cloudflare Pages · **Edit** | your account |

Nothing else. Record → GitHub secret `CLOUDFLARE_API_TOKEN`.

### 12.2 Create the project

Pages requires a first deployment before the project settings exist. Create it
with a one-off local upload:

```bash
cd frontend
npm ci
VITE_API_URL=https://api.martyglobal.com/v1 \
VITE_AUTH_URL=https://api.martyglobal.com \
VITE_SITE_URL=https://martyglobal.com \
VITE_TURNSTILE_SITE_KEY=<production site key> \
VITE_SENTRY_DSN=<frontend DSN> \
VITE_SENTRY_ENVIRONMENT=production \
VITE_SENTRY_RELEASE=$(git rev-parse HEAD) \
npm run build

npx wrangler pages project create marty-global --production-branch main
npx wrangler pages deploy dist --project-name=marty-global --branch=main
```

**Direct Upload, not the Git integration** — every `VITE_*` is compile-time, the
Sentry release needs the commit SHA, and the frontend deploy has to be orderable
against the backend release (CI-CD-Plan §5).

### 12.3 Custom domains

Pages → `marty-global` → **Custom domains** → **Set up a domain**:

- `martyglobal.com` → production
- `www.martyglobal.com` → production
- `staging.martyglobal.com` → preview branch `dev`

Cloudflare updates the DNS records from Phase 2.3 automatically. Certificates
issue within a few minutes.

### 12.4 Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://martyglobal.com/
curl -s -o /dev/null -w '%{http_code}\n' https://martyglobal.com/app/billing   # 200, not 404
curl -sI https://martyglobal.com/ | grep -i -E 'content-security|strict-transport|x-frame'
curl -s https://martyglobal.com/robots.txt
```

`/app/billing` returning 404 means `_redirects` did not ship — check it is in
`frontend/public/`, not `frontend/`.

Open the browser console on the portal and the admin and confirm the CSP
report-only header logs no violations before switching it to enforcing (Phase
1.4).

---

## Phase 13 — Backups

Nothing here is optional. The database holds filings and payments under
regulatory retention, and Deployment-Plan §11 sets the targets: **RPO ≤ 5
minutes, RTO ≤ 60 minutes**.

### 13.1 pgBackRest repository on R2

```bash
apt install -y pgbackrest

openssl rand -base64 48 | tr -d '\n' > /root/.pgbackrest-cipher   # record it
chmod 600 /root/.pgbackrest-cipher

cat > /etc/pgbackrest/pgbackrest.conf <<EOF
[global]
repo1-type=s3
repo1-s3-endpoint=<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
repo1-s3-bucket=marty-backups
repo1-s3-region=auto
repo1-s3-uri-style=path
repo1-s3-key=<R2 backup token key>
repo1-s3-key-secret=<R2 backup token secret>
repo1-path=/pgbackrest
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=$(cat /root/.pgbackrest-cipher)
repo1-retention-full=8
repo1-retention-diff=14
process-max=4
log-level-console=info
log-level-file=detail
start-fast=y

[marty]
pg1-path=/var/lib/marty/postgres
pg1-host-user=postgres
EOF
chmod 600 /etc/pgbackrest/pgbackrest.conf
```

**Encryption is mandatory.** These dumps contain identity documents, addresses,
and tax IDs — an unencrypted backup in object storage is the same exposure as an
open bucket. Store `repo1-cipher-pass` in the password manager; **a lost
passphrase means the backups are unrecoverable**.

Create a third R2 token scoped to `marty-backups` + `marty-archive` with Object
Read & Write. Do not reuse the app token.

```bash
pgbackrest --stanza=marty stanza-create
pgbackrest --stanza=marty check          # verifies archive_command works
pgbackrest --stanza=marty --type=full backup
pgbackrest --stanza=marty info
```

### 13.2 Schedules

```bash
cat > /etc/cron.d/marty-backup <<'EOF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# full weekly, incremental daily
0 2 * * 0 root pgbackrest --stanza=marty --type=full backup
0 2 * * 1-6 root pgbackrest --stanza=marty --type=incr backup

# logical dump — restores a single table, and survives a Postgres major upgrade
0 3 * * * root /opt/marty/backup/logical-dump.sh daily

# monthly archive, 7-year retention
0 4 1 * * root /opt/marty/backup/logical-dump.sh monthly

# nightly restore canary — a backup nobody has restored is a hypothesis
30 4 * * * root /opt/marty/backup/restore-drill.sh

# R2 -> Storage Box mirror: one provider outage must not take live data AND
# every backup
0 5 * * * root /opt/marty/backup/mirror.sh
EOF
```

`/opt/marty/backup/logical-dump.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
KIND="${1:-daily}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="/var/backups/marty/${KIND}-${STAMP}.dump"

cd /opt/marty
docker compose exec -T postgres pg_dump -U marty -Fc marty > "$OUT"
pg_restore --list "$OUT" > /dev/null           # prove it is readable
age -r "$(cat /opt/marty/backup/age-recipient.txt)" -o "${OUT}.age" "$OUT"
rm "$OUT"

if [ "$KIND" = "monthly" ]; then
  rclone copy "${OUT}.age" r2:marty-archive/postgres/    # 7-year retention
else
  rclone copy "${OUT}.age" r2:marty-backups/logical/
  find /var/backups/marty -name 'daily-*.age' -mtime +30 -delete
fi
```

Generate the age keypair on your laptop, keep the **private** key in the password
manager, put only the public recipient on the server:

```bash
age-keygen -o marty-backup.key      # private -> password manager
# public line -> /opt/marty/backup/age-recipient.txt
```

`/opt/marty/backup/mirror.sh` — the second-provider copy:

```bash
#!/usr/bin/env bash
set -euo pipefail
rclone sync r2:marty-backups        storagebox:marty/backups  --fast-list
rclone sync r2:marty-archive        storagebox:marty/archive  --fast-list
rclone sync r2:marty-prod           storagebox:marty/r2-objects --fast-list
docker compose -f /opt/marty/docker-compose.yml exec -T redis redis-cli BGSAVE
sleep 20
docker cp marty-redis-1:/data/dump.rdb /var/backups/marty/redis.rdb
rclone copy /var/backups/marty/redis.rdb storagebox:marty/redis/
```

### 13.3 Hetzner Storage Box

1. Hetzner Robot → **Storage Box** → order **BX11** (1 TB, ~€4/mo).
2. Enable **SSH support** and **external reachability**.
3. Create a sub-account for backups only.
4. Configure `rclone` on the server:

```bash
rclone config
# remote "r2"          -> type s3, provider Cloudflare, endpoint <acct>.r2.cloudflarestorage.com
# remote "storagebox"  -> type sftp, host uXXXXX.your-storagebox.de, key auth
rclone lsd r2:
rclone lsd storagebox:
```

Consider an append-only SSH key on the Storage Box so a compromised server cannot
delete the offsite copies.

### 13.4 R2 object protection

- `marty-prod`: versioning on, noncurrent versions expire after 90 days
  (Phase 3.1).
- `marty-archive`: check whether bucket lock / immutability is available on your
  plan. If it is, apply it for the 7-year retention. If it is not, the append-only
  Storage Box copy is the substitute.

### 13.5 The restore canary

`/opt/marty/backup/restore-drill.sh` — this is the step that turns a silently
broken backup into a red build:

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

docker run -d --name drill-pg -e POSTGRES_PASSWORD=drill postgres:18-alpine
sleep 15

LATEST="$(ls -t /var/backups/marty/daily-*.age | head -1)"
age -d -i /root/marty-backup.key "$LATEST" > /tmp/drill.dump

docker exec -i drill-pg psql -U postgres -c 'CREATE DATABASE drill;'
docker exec -i drill-pg pg_restore -U postgres -d drill --no-owner < /tmp/drill.dump

for t in "User" "Order" "Payment" "AuditLog"; do
  n=$(docker exec drill-pg psql -U postgres -d drill -tAc "SELECT count(*) FROM \"$t\";")
  echo "$t=$n"
  [ "$n" -gt 0 ] || { echo "FAIL: $t empty"; docker rm -f drill-pg; exit 1; }
done

# freshness: the newest payment must be within 24 h
docker exec drill-pg psql -U postgres -d drill -tAc \
  "SELECT 1 FROM \"Payment\" WHERE \"createdAt\" > now() - interval '24 hours' LIMIT 1;" \
  | grep -q 1 || echo "WARN: no payment in the last 24h (may be legitimate)"

docker rm -f drill-pg; rm -f /tmp/drill.dump
echo "$STAMP" > /var/backups/marty/last-successful-drill
rclone copy /var/backups/marty/last-successful-drill r2:marty-backups/heartbeat/
```

The nightly GitHub workflow (CI-CD-Plan §4.4) fails when that heartbeat is older
than 26 hours.

### 13.6 Prove PITR before go-live — once, deliberately

```bash
# 1. note the time and a known row
docker compose exec -T postgres psql -U marty -d marty -c "SELECT now();"
# 2. insert a marker, wait 5 min (one archive_timeout window)
# 3. restore to just before the marker into a scratch instance
pgbackrest --stanza=marty --type=time --target='2026-08-01 12:00:00+00' \
           --target-action=promote restore
# 4. confirm the marker is absent
```

Do not skip this. A WAL chain that has never been replayed is not a recovery
plan.

### 13.7 Retention summary

| Layer | Frequency | Retention | Where |
| --- | --- | --- | --- |
| WAL archive | ≤5 min | with its base backup | R2 `marty-backups` |
| Full | Sunday 02:00 UTC | 8 weeks | R2 |
| Incremental | daily 02:00 UTC | 14 days | R2 |
| Logical dump | daily 03:00 UTC | 30 days | R2 + Storage Box |
| Monthly archive | 1st, 04:00 UTC | **7 years** | R2 `marty-archive` + Storage Box |
| Pre-deploy dump | every release | 30 days | local + R2 |
| R2 object versions | continuous | 90 days noncurrent | R2 |
| Redis RDB | daily | 7 days | Storage Box |
| Config tarball (age) | weekly | 1 year | R2 + password manager |

Confirm the 7-year figure against the actual regulatory requirement per filing
jurisdiction rather than assuming it.

### 13.8 Back up the configuration too

```bash
cat > /etc/cron.d/marty-config-backup <<'EOF'
0 6 * * 0 root tar czf - -C /opt marty --exclude=releases \
  | age -r "$(cat /opt/marty/backup/age-recipient.txt)" \
  > /tmp/marty-config.tar.gz.age \
  && rclone copy /tmp/marty-config.tar.gz.age r2:marty-backups/config/ \
  && rm /tmp/marty-config.tar.gz.age
EOF
```

Rebuilding this server from scratch must be possible from three things and
nothing else: **this repo + the encrypted config tarball + the pgBackRest repo.**

---

## Phase 14 — Monitoring & alerting

### 14.1 Uptime

Any external monitor (Better Stack, UptimeRobot, Hetzner's own):

| Check | URL | Interval | Alert |
| --- | --- | --- | --- |
| API | `https://api.martyglobal.com/v1/health` — expect `"status":"ok"` | 1 min | 2 consecutive failures → email + SMS |
| Site | `https://martyglobal.com/` — expect 200 | 1 min | same |
| Deep link | `https://martyglobal.com/app/billing` — expect 200 | 15 min | catches a broken SPA fallback |
| TLS expiry | both hostnames | daily | < 14 days |

### 14.2 Host metrics

```bash
cat > /etc/cron.d/marty-disk <<'EOF'
*/15 * * * * root df -h / /var/lib/marty | awk 'NR>1 && int($5) > 80 {print}' \
  | mail -s "marty: disk above 80%" ops@martyglobal.com
EOF
```

Enable Hetzner's built-in CPU/disk/network graphs and alerts on the server.

### 14.3 Application thresholds

| Signal | Where | Threshold |
| --- | --- | --- |
| Postgres connections | `pg_stat_activity` | > 80% of `max_connections` |
| Longest transaction | `pg_stat_activity` | > 5 min |
| Redis memory | `INFO memory` vs 512 MB | > 80% — `noeviction` means a full Redis *rejects writes* |
| BullMQ failed | queue counts | any sustained failure |
| BullMQ waiting | queue counts | > 100 |
| USDT poller | age of the last successful sweep | > 5 × `TRON_POLL_INTERVAL_SECONDS` |
| **Unmatched transfers** | the `UnmatchedTransfer` table | **any new row** |
| SES bounce rate | SNS + SES dashboard | > 3% |
| Backup heartbeat | `last-successful-drill` in R2 | > 26 h |

The two business-critical alerts are **unmatched transfer** (a customer paid and
was not credited) and **BullMQ failed** (a customer is waiting on an email that
will never arrive). Wire those to a phone, not an inbox.

### 14.4 Logs

Pino JSON → Docker `json-file`, rotated at 10 MB × 5 (Phase 8.5 and per service
in compose). Caddy rotates its own at 20 MB × 5. Grafana Cloud's free tier with
Promtail is the cheapest next step if log search becomes necessary — not at
launch.

---

## Phase 15 — Turn the pipeline on

Only now, with a working manually-deployed backend and a live frontend.

### 15.1 Add the workflows

Create the five files from CI-CD-Plan §4, in a branch off `dev`:

```
.github/workflows/ci.yml
.github/workflows/deploy-frontend.yml
.github/workflows/deploy-backend.yml
.github/workflows/nightly.yml
.github/workflows/codeql.yml
```

Merge `ci.yml` and `codeql.yml` **first**, alone. Let them run green on `dev` for
a few days before adding the deploy workflows — a red CI on its own is a fixable
morning; a red CI wired to a deploy is an outage.

### 15.2 Staging CD

Merge `deploy-backend.yml` and `deploy-frontend.yml` with the tag triggers
removed, so only `dev` pushes deploy. Then:

- [ ] Push a trivial change to `dev`. Watch the whole chain.
- [ ] Confirm the image appears in GHCR tagged with the SHA.
- [ ] Confirm `/opt/marty/releases/current` updated.
- [ ] Confirm the staging site serves the change.
- [ ] **Break it deliberately** — deploy a commit whose `/v1/health` fails — and
      confirm `deploy.sh` rolls back on its own and the workflow goes red.
- [ ] Repeat until ten consecutive deploys are clean.

### 15.3 Production CD

Add the tag triggers back. First production release:

```bash
git checkout main && git merge --ff-only dev
git tag -a v1.0.0 -m "Initial production release"
git push origin main --tags
```

The workflow pauses at the `production` environment for the reviewer approval,
then runs backend → frontend in that order.

### 15.4 Rehearse a rollback before you need one

```bash
# frontend: Cloudflare Pages -> Deployments -> previous -> Rollback   (seconds)
# backend:
ssh root@<HETZNER_IPV4> "/opt/marty/deploy.sh <previous-sha>"        # ~30s
```

Time both. Write the numbers in the runbook.

---

## Phase 16 — Verification

Everything below runs against **production**, before announcing.

### 16.1 Infrastructure

- [ ] `https://api.martyglobal.com/v1/health` → `{"data":{"status":"ok"}}`
- [ ] `https://api.martyglobal.com/v1/services` without a cookie → **401** with
      the `{ error: { code, message } }` envelope
- [ ] `https://martyglobal.com/app/billing` on a hard refresh → **200**
- [ ] Security headers present on both hosts (HSTS, CSP, X-Frame-Options)
- [ ] `nmap -Pn <HETZNER_IPV4>` shows **only** 22, 80, 443 — 5432 and 6379 closed
- [ ] TLS grade A on both hostnames
- [ ] `docker compose ps` — all four services healthy
- [ ] A reboot brings everything back unattended (`restart: unless-stopped`):
      `reboot`, wait, re-run the health check

### 16.2 Auth and session

- [ ] Sign up with a real external address → **verification email arrives from
      SES** (not a verified test address — that would pass in the sandbox and
      fail for customers)
- [ ] Password reset end to end, link opens `/reset-password/new`
- [ ] Sign in, hard-refresh — session survives. This is the proof that the
      cookie/domain reasoning in Deployment-Plan §4 is right.
- [ ] Bootstrap admin can reach `/admin`; a customer account gets 403
- [ ] Sign out clears the session

### 16.3 Money — the one that must not be rushed

- [ ] Order wizard → quote issued in the portal → USDT payment screen renders the
      address and the exact amount
- [ ] **Send one small real mainnet transfer.** Confirm: the poller picks it up,
      it credits only after 19 confirmations, the `Payment` row records the tx
      hash, and the audit entry exists.
- [ ] Send a second transfer for a *wrong* amount → lands in `UnmatchedTransfer`
      and warns once, rather than crediting anything
- [ ] Confirm the rate lock: a quote past `USDT_RATE_TTL_MINUTES` is held, not
      credited at a stale rate

### 16.4 Storage and files

- [ ] Upload a document in the portal → browser PUTs straight to R2 (Network tab
      shows the R2 host, not the API) → the file renders through a presigned URL
- [ ] The presigned URL 403s after `R2_PRESIGNED_URL_TTL_SECONDS` (300)
- [ ] The bucket is not publicly listable: `curl https://<bucket-public-guess>` → denied
- [ ] Admin mail-scan upload works

### 16.5 Chat, notifications, public endpoints

- [ ] Live chat: customer ↔ staff both directions, history survives a reload
- [ ] Offline handoff: leave a message with no staff connected → email arrives
      after `SUPPORT_HANDOFF_DELAY_MINUTES`
- [ ] Marketing chat bubble: blocked without a Turnstile token
- [ ] Contact form: rate-limited, Turnstile-verified
- [ ] In-app notifications appear

### 16.6 Observability

- [ ] Trigger a deliberate 500 → the event appears in the backend Sentry project,
      with no request body and no PII
- [ ] Trigger a browser error → the frontend Sentry project, tagged with the
      release SHA
- [ ] Confirm `AppError` 4xx do **not** create Sentry issues
- [ ] Take an uptime monitor down deliberately → the alert reaches a phone

### 16.7 Data protection

- [ ] `pgbackrest --stanza=marty info` shows a full plus at least one incremental
- [ ] The restore canary heartbeat is under 26 h old
- [ ] The PITR drill (13.6) passed
- [ ] The Storage Box mirror has yesterday's dump
- [ ] The age private key and the pgBackRest passphrase are in the password
      manager, and someone other than you can find them

### 16.8 Content and legal — before the site is public

- [ ] No fabricated testimonials, statistics, or partner logos anywhere on
      marketing
- [ ] No price quoted anywhere on marketing — the binding figure is the itemised
      quote in the portal
- [ ] The "not a law firm" footer disclaimer is present
- [ ] Privacy policy and terms reflect what is actually collected and where it is
      stored (Cloudflare R2, AWS SES, Hetzner)
- [ ] `robots.txt` and `sitemap.xml` correct; **staging is noindexed**
- [ ] SMS: either it sends, or the channel is gone from `/app/settings`

---

## Phase 17 — Handover

### 17.1 Credential inventory

One password-manager entry each. Every one of these is unrecoverable if lost.

| Credential | Where it lives | Rotate |
| --- | --- | --- |
| Hetzner console | — | as needed |
| `~/.ssh/marty_admin` (private) | laptop + vault | annually |
| `~/.ssh/marty_ci` (private) | GitHub secret + vault | quarterly |
| `/opt/marty/.env` (whole file) | server + vault copy | — |
| `BETTER_AUTH_SECRET` | `.env` | quarterly — **signs everyone out** |
| Postgres password | `secrets/pg_password` | annually |
| `ADMIN_PASSWORD` | `.env` — reapplied on every boot | quarterly |
| AWS SES key pair | `.env` | quarterly |
| R2 app token | `.env` | quarterly |
| R2 backup token | `pgbackrest.conf` | quarterly |
| **pgBackRest cipher passphrase** | vault only | **never — losing it destroys every backup** |
| **age private key** | vault only | **never — same** |
| Turnstile secret | `.env` | as needed |
| TronGrid key | `.env` | as needed |
| Cloudflare API token | GitHub secret | quarterly |
| GHCR PAT | server + GitHub | quarterly |
| **Tron wallet private key** | **offline business custody — never on this server** | — |

### 17.2 Recurring calendar

| Cadence | Task |
| --- | --- |
| Daily (automated) | incremental backup, logical dump, restore canary, R2 mirror |
| Weekly | review Sentry issues; `docker compose pull` for postgres/redis/caddy; config tarball |
| Monthly | check disk growth and `AuditLog` size; review SES bounce rate; check Dependabot |
| Quarterly | **full restore drill to a scratch box, timed against the 60-minute RTO**; rotate the credentials marked quarterly above; review the firewall's admin-IP allowlist |
| Annually | Postgres major-version upgrade plan; review the 7-year retention against the actual regulatory requirement |

### 17.3 Where things are written down

- **Deployment-Plan.md §17** — runbooks: API down, database restore, disk full, a
  customer paid and was not credited, emails not arriving, leaked secret,
  rolling back a destructive migration.
- **CI-CD-Plan.md §8** — the rollback matrix.
- **This file** — how it was built, and how to build it again.

### 17.4 Update the docs after go-live

`README.md` still says "Frontend is a static build; host TBD" and lists a stale
stack (shadcn/ui, Zustand — neither is installed). AGENTS.md line 196 says
deploys are undecided. Both should now point at these three documents.

---

## Quick reference

```bash
# ---- status --------------------------------------------------------------
ssh root@<HETZNER_IPV4>
cd /opt/marty && docker compose ps
docker compose logs -f api --tail=200

# ---- deploy / rollback ---------------------------------------------------
/opt/marty/deploy.sh <sha>
cat /opt/marty/releases/current

# ---- database ------------------------------------------------------------
docker compose exec postgres psql -U marty -d marty
pgbackrest --stanza=marty info
pgbackrest --stanza=marty check

# ---- health --------------------------------------------------------------
curl -s https://api.martyglobal.com/v1/health
curl -s -o /dev/null -w '%{http_code}\n' https://api.martyglobal.com/v1/services   # 401

# ---- restart a single service -------------------------------------------
docker compose up -d --no-deps --force-recreate api

# ---- emergency stop ------------------------------------------------------
docker compose stop api        # Caddy stays up and returns 502
```
