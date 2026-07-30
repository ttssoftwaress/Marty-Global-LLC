# Deployment Plan — Marty Global LLC

Production topology, provisioning, release procedure, data protection, and the
runbooks. Companion to **CI-CD-Plan.md**, which owns the pipeline that drives it.

Everything below is a plan. Nothing has been provisioned.

---

## 1. Architecture

```
                        ┌──────────────────────────────────────┐
   browser ─────────────► Cloudflare (DNS + CDN + Turnstile)   │
                        └──┬──────────────────────────┬────────┘
                           │ static                   │ api.martyglobal.com
                           ▼                          ▼  (DNS-only, grey cloud)
                  Cloudflare Pages            ┌────────────────────────────┐
                  marty-global                │  Hetzner CAX31 (arm64)     │
                  martyglobal.com             │  Ubuntu 24.04 LTS          │
                  www / staging               │                            │
                                              │  ┌──────────────────────┐  │
   browser ──── presigned PUT/GET ──────────► │  │ Caddy :80 :443       │  │
                           │                  │  │  TLS (Let's Encrypt) │  │
                           ▼                  │  └──────────┬───────────┘  │
                  Cloudflare R2               │             ▼              │
                  (private bucket)            │  ┌──────────────────────┐  │
                                              │  │ api  :4000           │  │
   ┌───────────────────────────────┐          │  │  Express + Socket.io │  │
   │ Amazon SES  (email)           │◄─────────┤  │  + BullMQ workers    │  │
   │ Twilio      (SMS — unbuilt)   │          │  └────┬────────────┬────┘  │
   │ TronGrid    (USDT polling)    │◄─────────┤       ▼            ▼       │
   │ Sentry      (errors)          │          │  ┌─────────┐  ┌────────┐   │
   └───────────────────────────────┘          │  │Postgres │  │ Redis  │   │
                                              │  │  18     │  │   8    │   │
                                              │  └────┬────┘  └────────┘   │
                                              └───────┼────────────────────┘
                                                      │ WAL + nightly dump
                                                      ▼
                                         Cloudflare R2 (backups) + Hetzner Storage Box
```

**Why this shape**

- The frontend is a static bundle with no server-side rendering. Pages is free,
  global, and rolls back instantly.
- The backend is deliberately one process — API, sockets, and jobs together
  (AGENTS.md, Backend). One container, one port, one release unit.
- Postgres and Redis run on the same host, in containers with named volumes.
  Hetzner has no managed Postgres; a second VM doubles cost and adds a network
  hop for every query. The trade-off — the database shares fate with the app —
  is bought back with the backup plan in §11, not ignored.
- **`api.martyglobal.com` is DNS-only (grey cloud), not proxied.** Reason in §4.

---

## 2. Environments

| | Staging | Production |
| --- | --- | --- |
| Frontend | `staging.martyglobal.com` (Pages, `dev` branch) | `martyglobal.com` + `www` (Pages, `main`) |
| Backend | `api-staging.martyglobal.com` | `api.martyglobal.com` |
| Host | same box, second compose project | primary box |
| Postgres | `marty_staging` DB, own container + volume | `marty` DB |
| Redis | own container (own volume) | own container |
| `TRON_NETWORK` | `nile` (testnet) | `mainnet` |
| SES | sandbox or a separate verified identity | production access |
| R2 | `marty-staging` bucket | `marty-prod` bucket |
| Sentry | `SENTRY_ENVIRONMENT=staging` | `production` |
| Data | scaffolded/seeded, never a production copy | real |

**Never restore a production dump into staging.** The database holds identity
documents, addresses, and tax IDs (AGENTS.md, Security & PII). Staging uses
`npm run db:setup` (`db:seed` + `db:scaffold`).

---

## 3. DNS (Cloudflare)

| Record | Type | Value | Proxy |
| --- | --- | --- | --- |
| `martyglobal.com` | CNAME | `marty-global.pages.dev` | proxied |
| `www` | CNAME | `marty-global.pages.dev` | proxied |
| `staging` | CNAME | `marty-global.pages.dev` | proxied |
| `api` | A / AAAA | Hetzner IPv4 / IPv6 | **DNS only** |
| `api-staging` | A / AAAA | same host | **DNS only** |
| `_dmarc` | TXT | `v=DMARC1; p=quarantine; rua=mailto:dmarc@martyglobal.com; fo=1` | — |
| `@` | TXT | `v=spf1 include:amazonses.com -all` | — |
| SES DKIM ×3 | CNAME | from the SES console | — |
| SES MAIL FROM | MX + TXT | `feedback-smtp.<region>.amazonses.com` | — |
| CAA | CAA | `0 issue "letsencrypt.org"` | — |

Domain registration/nameservers: point the registrar at Cloudflare nameservers
before anything else — the Pages custom domain, the Turnstile widget, and the
SES DKIM verification all wait on it.

---

## 4. The cookie constraint — read before choosing domains

Better Auth (`config/auth.ts`) issues the session cookie from the API origin with
its defaults: `SameSite=Lax`, `Secure` (derived from an `https` `BETTER_AUTH_URL`).
`services/api.ts` calls with `credentials: 'include'`, and `socket.ts` opens the
handshake with `withCredentials`.

- `martyglobal.com` → `api.martyglobal.com` is **cross-origin but same-site**
  (same registrable domain). `SameSite=Lax` cookies are sent. This works with
  the code exactly as it is — no `advanced.crossSubDomainCookies` needed, because
  only the API reads the cookie.
- `marty-global.pages.dev` → `api.martyglobal.com` is **cross-site**. The cookie
  is not sent, and every authenticated request 401s. That is why PR previews
  cannot exercise authenticated flows (CI/CD-Plan §3), and why the custom domain
  must be live before the first real login test.

Consequences to hold to:

1. Frontend and API must share a registrable domain. Do not host the portal on a
   different apex.
2. `FRONTEND_ORIGIN` is an exact-origin allowlist (`config/env.ts` pipes it
   through `z.url()` per entry, no wildcards). Production is
   `https://martyglobal.com,https://www.martyglobal.com`.
   **The first entry is the canonical URL used to build every email link**
   (`publicAppUrl`) — put the apex first, not `www`.
3. `BETTER_AUTH_URL=https://api.martyglobal.com` — must be the public URL, https,
   no trailing slash.
4. If the API is ever put behind the Cloudflare proxy, `app.set('trust proxy', 1)`
   in `app.ts:21` becomes wrong: the chain is then Cloudflare → Caddy → app (two
   hops), Express resolves `req.ip` to a Cloudflare edge address, and every
   caller in the world shares one rate-limit bucket. Fix would be either
   `trust proxy 2` or having Caddy overwrite `X-Forwarded-For` with
   `CF-Connecting-IP`. **Keeping `api` grey-cloud keeps the existing `1` correct**
   — that is the reason for the choice, and the trade-off is no Cloudflare DDoS
   shield on the API. Revisit deliberately, with the code change in the same PR.

---

## 5. Hetzner server

**Spec.** CAX31 — 8 vCPU Ampere arm64, 16 GB RAM, 160 GB NVMe, ~€13/mo
(approximate; verify current pricing). Falls back to CPX31 (x86) if arm64 CI
runners are unavailable. arm64 is safe here: `node:24-alpine`, `postgres:18-alpine`,
`redis:8-alpine`, and `caddy` are all multi-arch.

Sizing rationale: Postgres wants ~4 GB shared/cache for a 42-model schema with
audit-log growth, Node + Prisma ~1 GB, Redis ~512 MB, headroom for a blue/green
second container and for `pg_dump`. CAX21 (8 GB) works at launch; CAX31 avoids a
resize during the first year.

**Storage.** Attach a 40 GB Hetzner Volume mounted at `/var/lib/marty/postgres`.
Separating the data from the boot disk means the DB survives a server rebuild and
can be snapshotted independently.

**Base build** (Ubuntu 24.04 LTS):

```bash
# users
adduser --disabled-password deploy && usermod -aG docker deploy
# ssh: key only
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/;
        s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
# unattended security updates + fail2ban
apt install -y unattended-upgrades fail2ban
dpkg-reconfigure -plow unattended-upgrades
# docker engine + compose plugin (official repo, not the distro package)
# swap: 4G file — Postgres + a build should never OOM-kill the API
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
# time sync matters: USDT rate TTLs and session expiry are time-derived
timedatectl set-ntp true
```

**Hetzner Cloud Firewall** (in front of the host, so a misconfigured container
port is not exposed):

| Port | Source | Purpose |
| --- | --- | --- |
| 22 | admin IPs only (or a Tailscale/WireGuard subnet) | SSH |
| 80 | any | ACME HTTP-01 + redirect |
| 443 | any | API + WebSocket |

Postgres (5432) and Redis (6379) are **never** published to the host. In the
compose file they get no `ports:` mapping at all — only the internal network.
This is a change from the dev `docker-compose.yml`, which publishes 5433/6379 for
local tooling.

**Deploy key restriction** in `/home/deploy/.ssh/authorized_keys`:

```
command="/opt/marty/deploy.sh $SSH_ORIGINAL_COMMAND",no-agent-forwarding,no-port-forwarding,no-pty,no-X11-forwarding ssh-ed25519 AAAA... github-actions-deploy
```

A stolen CI key can then only run a deploy, not read `/opt/marty/.env`.

---

## 6. The production stack

`/opt/marty/` on the host:

```
/opt/marty/
├── docker-compose.yml
├── .env                    # root:root 0600 — every backend secret
├── Caddyfile
├── deploy.sh
├── backup/
│   ├── pgbackrest.conf
│   └── restore-drill.sh
└── releases/               # last 5 deployed SHAs, for rollback
```

`docker-compose.yml` (production — note this is **not** the repo's dev compose):

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
      start_period: 30s
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
      - ./backup:/backup:ro
    command: >-
      postgres -c wal_level=replica -c archive_mode=on
               -c archive_command='pgbackrest --stanza=marty archive-push %p'
               -c max_wal_size=2GB -c shared_buffers=4GB
               -c effective_cache_size=10GB -c log_min_duration_statement=500
    secrets: [pg_password]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U marty -d marty']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --appendfsync everysec --maxmemory 512mb --maxmemory-policy noeviction
    volumes: [redis-data:/data]
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

secrets:
  pg_password: { file: ./secrets/pg_password }

volumes:
  redis-data:
  caddy-data:
  caddy-config:
```

Three details that are not cosmetic:

- **`SENTRY_RELEASE: ${IMAGE_TAG}` on `api`.** It is an `environment:` entry
  rather than a line in `.env` because its value changes on every deploy while
  `.env` is static — `IMAGE_TAG` is already the variable `deploy.sh` exports when
  it swaps the API container (§7), so the release tag follows the image for free.
- **`--maxmemory-policy noeviction`.** Redis holds BullMQ jobs *and* the
  rate-limit store (`rate-limit-redis`). An LRU policy would silently evict
  queued notification emails and payment-reconciliation jobs under memory
  pressure. Better to fail loudly.
- **`--appendonly yes`.** The dev compose has no persistence flags; a restart
  there loses the queue. In production, losing the queue means unsent
  verification emails and a paused USDT poller schedule.

`Caddyfile`:

```
api.martyglobal.com {
	encode zstd gzip
	# Socket.io upgrades are handled transparently by reverse_proxy.
	reverse_proxy api:4000 {
		header_up X-Forwarded-For {remote_host}   # exactly one hop — matches trust proxy 1
		header_up X-Forwarded-Proto {scheme}
	}
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		-Server
	}
	log {
		output file /data/access.log { roll_size 20mb roll_keep 5 }
		format json
	}
}

api-staging.martyglobal.com {
	reverse_proxy api-staging:4000 { header_up X-Forwarded-For {remote_host} }
}
```

`header_up X-Forwarded-For {remote_host}` **overwrites** rather than appends —
a client-supplied `X-Forwarded-For` cannot then prepend a fake address and slip
past `express-rate-limit`. This is what makes `trust proxy 1` safe.

---

## 7. Release procedure

`/opt/marty/deploy.sh <sha>` — invoked by the pipeline over the restricted SSH
key, and by a human for a rollback.

```bash
#!/usr/bin/env bash
set -euo pipefail
SHA="${1:?usage: deploy.sh <sha>}"
cd /opt/marty
source .env.deploy                       # GHCR read token, non-secret app env

PREV=$(cat releases/current 2>/dev/null || echo none)
echo "deploy $PREV -> $SHA"

# 1. pull both images first — a registry failure must not stop a running API
docker pull "ghcr.io/.../backend:$SHA"
docker pull "ghcr.io/.../migrate:$SHA"

# 2. pre-migration backup — the rollback path for a destructive migration
docker compose exec -T postgres pg_dump -U marty -Fc marty \
  > "/var/backups/marty/pre-deploy-$SHA.dump"
pgbackrest --stanza=marty --type=incr backup

# 3. migrations, as a one-shot container (Dockerfile `migrate` stage)
docker run --rm --network marty_default --env-file .env \
  "ghcr.io/.../migrate:$SHA"             # npx prisma migrate deploy

# 4. swap the API
IMAGE_TAG="$SHA" docker compose up -d --no-deps api

# 5. smoke test
for i in $(seq 1 10); do
  curl -fsS http://127.0.0.1:4000/v1/health && break || sleep 3
done
curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/v1/services | grep -q 401

# 6. record or roll back
if [ $? -eq 0 ]; then
  echo "$SHA" > releases/current
  docker image prune -f --filter "until=720h"
else
  echo "smoke failed — rolling back to $PREV"
  IMAGE_TAG="$PREV" docker compose up -d --no-deps api
  exit 1
fi
```

**Downtime.** `docker compose up -d --no-deps api` stops the old container and
starts the new one — roughly 10–20 s of 502s, plus the socket clients
reconnecting (which `socket.io-client` does on its own). Acceptable at launch.
Zero-downtime upgrade path in §14.

**Migration safety rules** (AGENTS.md: migrations only, never hand edits):

- Additive-only in the same release as the code that reads them. Drops wait one
  release (CI/CD-Plan §5).
- Anything rewriting a large table (`ALTER TABLE ... SET NOT NULL`, a new index
  on `AuditLog`) uses `CREATE INDEX CONCURRENTLY` in a separate migration —
  Prisma will not do it for you, and a lock on the audit table blocks every
  write path in the app.
- A migration that touches `Payment`, `Order`, or any filing record gets the
  pre-deploy dump verified (`pg_restore --list`) before it runs, not after.

**Boot behaviour to expect on every start** (`server.ts`): the admin account is
reconciled from `ADMIN_EMAIL`/`ADMIN_PASSWORD` and the process exits 1 if that
fails; the guest-chat purge repeatable job is re-registered (idempotent by
name+pattern); BullMQ workers register in-process.

---

## 8. Backend environment — production values

Derived from `backend/.env.example`; only the ones that change or must not be
left blank are listed.

| Variable | Production value | Note |
| --- | --- | --- |
| `NODE_ENV` | `production` | enables the SES credential refine |
| `LOG_LEVEL` | `info` | `debug` leaks volume, not PII, but still |
| `FRONTEND_ORIGIN` | `https://martyglobal.com,https://www.martyglobal.com` | apex first — it becomes `publicAppUrl` for every email link |
| `DATABASE_URL` | `postgresql://marty:…@postgres:5432/marty` | container hostname, not localhost |
| `REDIS_URL` | `redis://redis:6379` | |
| `BETTER_AUTH_SECRET` | 32+ bytes from `npx @better-auth/cli secret` | rotating logs everyone out |
| `BETTER_AUTH_URL` | `https://api.martyglobal.com` | |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | real, strong | re-applied on every boot; store in the password manager |
| `AWS_ACCESS_KEY_ID` / `_SECRET` | IAM user with `ses:SendEmail` only | boot fails without both in production |
| `SES_FROM_EMAIL` | `no-reply@martyglobal.com` | domain must be a verified SES identity |
| `R2_*` (4 + optional endpoint) | all four set | all-or-nothing refine; set `R2_ENDPOINT` if the bucket has an EU jurisdiction |
| `R2_PRESIGNED_URL_TTL_SECONDS` | `300` | these URLs are bearer tokens for identity documents |
| `TURNSTILE_SECRET_KEY` | required | **blocker B5** — the env schema does not enforce it yet, and without it the public guest-chat and contact endpoints pass every challenge |
| `TRON_NETWORK` | `mainnet` | boot refuses without `TRON_DEPOSIT_ADDRESS` + `TRONGRID_API_KEY` |
| `TRON_DEPOSIT_ADDRESS` | the real receiving address | **public address only — the private key never touches this server, this repo, or any backup** |
| `TRON_MIN_CONFIRMATIONS` | `19` | |
| `USDT_USD_RATE_MINOR` | commercial decision | integer over 1_000_000, never a float |
| `SENTRY_DSN` | backend project DSN | separate from `VITE_SENTRY_DSN` |
| `SENTRY_RELEASE` | the deployed image tag / commit SHA | set by the deploy, not stored in `.env` — the compose `api` block passes `${IMAGE_TAG}` (§6) |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | **backend only**; 0 by default, raise deliberately — it is a paid quota |
| `GUEST_CHAT_RETENTION_DAYS` | `7` | the one hard delete in the schema |

Frontend build-time (`VITE_*`, all seven baked into the bundle — nothing secret
belongs here): `VITE_API_URL=https://api.martyglobal.com/v1`,
`VITE_AUTH_URL=https://api.martyglobal.com`,
`VITE_SITE_URL=https://martyglobal.com`, `VITE_TURNSTILE_SITE_KEY` (public half),
`VITE_SENTRY_DSN` (browser DSN, public by design),
`VITE_SENTRY_ENVIRONMENT=production`, `VITE_SENTRY_RELEASE=<sha>`.

There is no frontend counterpart to `SENTRY_TRACES_SAMPLE_RATE`, and adding one
would do nothing: `frontend/src/lib/sentry.ts` hardcodes `tracesSampleRate: 0`
and deliberately omits `browserTracingIntegration()`. Browser tracing is a code
change there — add the integration and read a sample rate — not a configuration
change, and it is a paid-quota decision to make deliberately.

---

## 9. Cloudflare Pages configuration

- Project `marty-global`, **Direct Upload** (deploys come from Actions, not the
  Git integration — CI/CD-Plan §4.2).
- Production branch `main` → `martyglobal.com`, `www`. Preview branch `dev` →
  `staging.martyglobal.com`.
- `frontend/public/_redirects` (blocker B3):
  ```
  /*    /index.html   200
  ```
- `frontend/public/_headers` (blocker B4) — the portal renders scanned mail and
  identity documents, so the SPA needs its own headers; Helmet only covers API
  responses:
  ```
  /*
    Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
    Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://*.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.r2.cloudflarestorage.com; connect-src 'self' https://api.martyglobal.com wss://api.martyglobal.com https://*.sentry.io https://*.posthog.com https://*.r2.cloudflarestorage.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'
  ```
  `connect-src` must include the R2 host because uploads go **browser → R2**
  directly with a presigned PUT. `frame-src` is for the Turnstile widget.
  Validate in report-only mode on staging for one week before enforcing.
- `_headers`/`_redirects` must be in `frontend/public/`, which does not exist —
  create it.
- Cache: Pages hashes Vite assets, so `/assets/*` is immutable. `index.html`
  must **not** be cached long — a stale `index.html` pins users to a deleted
  asset bundle after a deploy.

---

## 10. External services — the setup nobody remembers until it breaks

**Amazon SES.** Verify the `martyglobal.com` domain, publish the three DKIM
CNAMEs, set a custom MAIL FROM subdomain, then **request production access** —
the sandbox only delivers to individually verified addresses, so password resets
and payment receipts silently fail for real customers. Create a configuration set
with an SNS bounce/complaint destination and put its name in
`SES_CONFIGURATION_SET`; a bounce rate over 5% gets the account suspended.
IAM user: `ses:SendEmail` + `ses:SendRawEmail` only.

**Cloudflare R2.** Private bucket, **public access off, no `r2.dev` domain**
(AGENTS.md, Security & PII). API token scoped Object Read & Write to that one
bucket. Then run, with the production `.env` loaded:

```bash
npm run storage:cors        # from backend/
```

Uploads are browser → R2, so every PUT is preflighted; a bucket with no CORS rule
answers with a 403 that looks exactly like a bad key, and nothing appears in
either the API log or the R2 log. Re-run this whenever `FRONTEND_ORIGIN` changes.
Enable **object versioning** on the bucket (§11).

**Cloudflare Turnstile.** One widget per environment. Public site key →
`VITE_TURNSTILE_SITE_KEY`; secret → `TURNSTILE_SECRET_KEY`.

**TronGrid.** Free read-only API key. `TRON_DEPOSIT_ADDRESS` is a public
receiving address created in TronLink. The key for it is held offline by the
business — **never** on this server, in this repo, in an env file, or in a
backup. The backend only watches transfers (AGENTS.md, Payments).

**Sentry.** Two projects (browser, server), two DSNs. `beforeSend` scrubbing is
already implemented in both apps; Session Replay stays off. Create a release per
deploy (the SHA) so an error maps to a build.

**Twilio — not deployable.** SMS is a known gap: there is no `config/twilio.ts`,
no `TWILIO_*` env, no SMS job. Notification preferences store an SMS channel that
nothing sends on. Either build it before launch or remove the SMS toggle from
`/app/settings` so the portal does not promise a channel that is silent.

---

## 11. Backups

Three independent things need protecting, with different characteristics.

### 11.1 Postgres — the only irreplaceable asset

Company records, filings, payments, audit log. AGENTS.md: filings and payments
carry regulatory retention and soft-delete rather than hard-delete, so the
backup retention has to outlive the records.

**Targets: RPO ≤ 5 minutes. RTO ≤ 60 minutes.**

**pgBackRest** with a Cloudflare R2 repository (S3-compatible), because it gives
point-in-time recovery — a nightly dump alone means losing up to 24 hours, which
for a payment ledger is not a backup strategy.

| Layer | Schedule | Retention | Destination |
| --- | --- | --- | --- |
| WAL archive (`archive_command`) | continuous, ≤5 min forced by `archive_timeout` | with its base backup | R2 `marty-backups` |
| Full backup | Sunday 02:00 UTC | 8 weeks | R2 |
| Incremental | daily 02:00 UTC | 14 days | R2 |
| `pg_dump -Fc` logical | daily 03:00 UTC | 30 days | R2 + Storage Box |
| Monthly archive dump | 1st of month | **7 years** | R2 (versioned, separate bucket) + Storage Box |
| Pre-deploy dump | every release | 30 days | local `/var/backups` + R2 |

- **Encryption.** pgBackRest `repo-cipher-type=aes-256-cbc` with a passphrase
  held in the password manager. The dumps contain identity documents, addresses,
  and tax IDs; an unencrypted backup in object storage is the same PII exposure
  as an open bucket.
- **Second provider.** R2 is the primary repo; `rclone sync` mirrors the daily
  and monthly dumps to a **Hetzner Storage Box** (BX11, 1 TB, ~€4/mo) nightly.
  One provider outage or one compromised Cloudflare token must not take both the
  live data and every backup.
- The logical `pg_dump` exists alongside pgBackRest on purpose: a physical backup
  only restores to the same Postgres major version, and it is the wrong tool for
  "restore one table someone truncated".

### 11.2 R2 objects — identity documents, mail scans, invoices

- Bucket **versioning on** — a deleted or overwritten scan is recoverable.
- Lifecycle: keep noncurrent versions 90 days.
- Nightly `rclone sync marty-prod: storagebox:r2-mirror/` — a second copy off
  Cloudflare.
- Verify whether R2 bucket lock / immutability is available on the current plan;
  if it is, apply it to the 7-year archive bucket. If not, the Storage Box copy
  plus an append-only SSH key is the substitute.

### 11.3 Redis — recoverable, but not free

BullMQ jobs and the rate-limit store. Losing it loses queued emails/SMS and the
guest-chat purge schedule (re-registered on next boot anyway). AOF
(`appendfsync everysec`) plus a daily RDB copy to the Storage Box is enough. Do
not treat it as durable state — nothing in the app should assume a job survives
a total Redis loss, and the processors are already idempotent and retry-safe
(AGENTS.md, Backend).

### 11.4 Configuration and secrets

- `/opt/marty/.env`, `Caddyfile`, `docker-compose.yml`, `deploy.sh`,
  `pgbackrest.conf` → `age`-encrypted tarball to R2 weekly, plus a copy of `.env`
  in the team password manager.
- A Hetzner server snapshot weekly (crash-consistent — a convenience for rebuild
  speed, **not** a database backup).
- Restoring a server from scratch must be possible from: this repo + the
  encrypted config tarball + the pgBackRest repo. Nothing else.

### 11.5 Verification — the part that is usually skipped

A backup that has never been restored is a hypothesis.

- **Nightly automated canary.** `restore-drill.sh` restores the latest backup
  into a throwaway container, runs `SELECT count(*)` against `User`, `Order`,
  `Payment`, `AuditLog`, checks the newest `Payment.createdAt` is within 24 h,
  writes a heartbeat file to R2, drops the container. `nightly.yml`
  (CI/CD-Plan §4.4) fails if the heartbeat is stale — a silently broken backup
  becomes a red build within a day.
- **Quarterly full drill.** Restore to a scratch Hetzner box, point a staging API
  at it, sign in, open an order, view a document. Record the wall-clock time and
  compare against the 60-minute RTO. Written up in this file's revision history.
- **PITR drill once, before go-live.** Pick a timestamp, restore to it, confirm a
  known row is absent. Prove the WAL chain works before needing it.

---

## 12. Monitoring and alerting

| Signal | Tool | Alert |
| --- | --- | --- |
| Uptime | external monitor on `https://api.martyglobal.com/v1/health` and `https://martyglobal.com/`, 1 min | 2 consecutive failures → email + SMS |
| Errors | Sentry (both projects, both environments) | new issue, and regressions; `AppError` is already excluded so 4xx noise stays out |
| TLS expiry | Caddy renews automatically; monitor cert age | < 14 days |
| Disk | node exporter or a cron `df` check | > 80% on `/` or the DB volume |
| Postgres | connection count, longest transaction, DB size growth | conn > 80% of `max_connections` |
| Redis | memory vs `maxmemory` (`noeviction` means a full Redis rejects writes) | > 80% |
| Queue depth | BullMQ waiting/failed counts | failed > 0 sustained, waiting > 100 |
| USDT poller | last successful TronGrid sweep age | > 5 × `TRON_POLL_INTERVAL_SECONDS` |
| Unmatched transfers | the `UnmatchedTransfer` queue | any new row — a customer paid and was not credited |
| SES | bounce + complaint rate via the configuration set | bounce > 3% |
| Backups | the §11.5 heartbeat | stale > 26 h |

Logs: Pino JSON → Docker `json-file` with rotation (10 MB × 5). Caddy access
logs rotate the same way. If log search becomes necessary, Grafana Cloud's free
tier with Promtail is the cheapest next step — not at launch.

The two business-critical alerts are **unmatched transfer** and **queue failed**:
the first means money arrived and nobody was credited, the second means a
customer is waiting for an email that will never arrive.

---

## 13. Security posture at deploy time

Beyond what the code already enforces (Helmet, exact-origin CORS, default-deny in
`routes.ts`, Redis-backed rate limits, presigned private R2, Sentry scrubbing):

1. **Add `backend/.dockerignore` before building any image** (blocker B1). Until
   it exists, `COPY . .` bakes `backend/.env` — Better Auth secret, DB
   credentials, AWS and R2 keys, admin password — into a build layer. If an image
   has already been built and pushed anywhere, rotate every one of those secrets
   and delete the image.
2. **Require `TURNSTILE_SECRET_KEY` in production** (blocker B5). Two public
   write endpoints (`/v1/guest-chat`, `/v1/contact`) are otherwise unprotected.
3. `.env` is `root:root 0600`; the `deploy` user cannot read it, and the deploy
   SSH key is `command=`-restricted.
4. Postgres and Redis have no published ports and no host firewall exception.
5. Container runs as `USER node` (already in the Dockerfile). Add
   `read_only: true` with `tmpfs: /tmp` once verified.
6. Weekly `docker compose pull` for `postgres`/`redis`/`caddy` base images plus
   `unattended-upgrades` on the host.
7. GHCR packages private; the host uses a read-only token.
8. Never log PII (already the rule) — check the Caddy access log format does not
   capture query strings containing presigned URL signatures.
9. **No Tron private key anywhere.** Verify before go-live that no env file,
   backup, or password-manager entry on this server holds one.
10. Quarterly: rotate `BETTER_AUTH_SECRET` (logs everyone out — maintenance
    window), R2 token, SES IAM key, GHCR token, deploy SSH key.

---

## 14. Zero-downtime — the Phase 4 upgrade

Launch accepts ~15 s of downtime per deploy. When that stops being acceptable:

- Caddy load-balances `api-blue` and `api-green` with active health checks;
  `deploy.sh` starts the inactive colour, waits for `/v1/health`, flips Caddy,
  drains the old one.
- Both colours run BullMQ workers briefly during the flip. That is safe —
  BullMQ locks each job and the processors are idempotent — but the TronGrid
  poller will sweep twice in that window. Confirm the double-credit guard (unique
  tx hash + match-and-credit in one transaction) covers it, which it should by
  design.
- Socket.io: the drained container's clients reconnect to the new one. Because
  sockets are transport-only and every message is persisted through the `support`
  service, no history is lost. There is no Redis adapter and none is needed while
  only one colour serves at a time — adding it is a stack-budget decision
  (AGENTS.md, Live Chat).

---

## 15. Approximate monthly cost

| Item | ~Cost |
| --- | --- |
| Hetzner CAX31 (8 vCPU arm64, 16 GB) | €13 |
| Hetzner Volume 40 GB | €2 |
| Hetzner Storage Box BX11 (1 TB) | €4 |
| Hetzner snapshots | €1 |
| Cloudflare Pages | €0 |
| Cloudflare R2 (documents + backups, ~50 GB) | ~$1 + egress-free reads |
| Amazon SES | $0.10 per 1,000 emails |
| Twilio | usage, once built |
| Sentry | free tier at launch |
| GitHub Actions | free tier (private repo minutes; arm64 runner usage to watch) |
| **Total** | **≈ €22–25/mo + usage** |

Prices are approximate — verify current Hetzner and Cloudflare pricing at
provisioning time. A separate staging box adds ~€4–7.

---

## 16. Go-live checklist

**Repo (blockers)**

- [ ] `backend/.dockerignore` (B1) — and rotate secrets if any image was already built
- [ ] Dockerfile `migrate` stage (B2)
- [ ] `frontend/public/_redirects` (B3)
- [ ] `frontend/public/_headers` with CSP (B4)
- [ ] `TURNSTILE_SECRET_KEY` required in production `env.ts` (B5)
- [ ] `sitemap.xml` + `robots.txt` (B6)
- [ ] Decide Playwright e2e: build or remove (B7)
- [ ] Remove or implement the SMS channel in `/app/settings` (§10)
- [ ] **Remove the fabricated testimonials, statistics, and partner logos from
      marketing** — AGENTS.md forbids inventing them, and shipping them publicly
      is a legal exposure, not a copy nit

**Accounts and DNS**

- [ ] Cloudflare nameservers live; all §3 records published
- [ ] SES domain verified, DKIM published, **production access granted**, SPF +
      DMARC live, bounce/complaint SNS wired
- [ ] R2 bucket private, versioning on, `npm run storage:cors` run against the
      production origin
- [ ] Turnstile widget created (both keys)
- [ ] TronGrid key; `TRON_DEPOSIT_ADDRESS` confirmed as the real receiving
      address, key held offline
- [ ] Sentry projects + DSNs
- [ ] GHCR package created, read-only token on the host

**Infrastructure**

- [ ] Server provisioned, volume mounted, firewall applied, SSH key-only
- [ ] `/opt/marty` stack up; Caddy issued certificates for both API hostnames
- [ ] `.env` complete and `0600`; API boots (env validation is the proof)
- [ ] Migrations applied; **no seed/scaffold data in production** — reference
      data (locations, mail carriers) is admin-managed at `/admin/settings`, not
      seeded
- [ ] Bootstrap admin can sign in at `/admin`
- [ ] pgBackRest stanza created, first full backup taken, **PITR drill passed**
- [ ] Restore canary green; Storage Box mirror running
- [ ] Monitors + alert routes tested (trigger one deliberately)

**Functional verification on production**

- [ ] Sign up → verification email delivered by SES (real inbox, not a verified
      test address)
- [ ] Password reset end to end
- [ ] Session survives a refresh (proves the cookie/domain reasoning in §4)
- [ ] Order wizard → quote → USDT payment screen; **one small real mainnet
      transfer credited end to end** before announcing
- [ ] Document upload browser → R2 → presigned view (proves the CORS policy)
- [ ] Live chat: customer ↔ staff, and the offline handoff email
- [ ] Guest chat blocked without a Turnstile token
- [ ] Deep link `https://martyglobal.com/app/billing` returns 200 on refresh
- [ ] Deploy a trivial change and **roll it back**, timed
- [ ] `npm run db:reset` is not runnable from the production host by accident

---

## 17. Runbooks

**API down.** `docker compose ps` → `docker compose logs --tail=200 api`. Most
likely: env validation failed on boot (the fatal log names the field, never the
value), the admin bootstrap threw (`server.ts` exits 1 by design), or Postgres is
unhealthy. Fix env → `docker compose up -d api`. If the image is bad,
`deploy.sh <previous-sha>`.

**Database restore.** Stop `api`. `pgbackrest --stanza=marty restore` (add
`--type=time --target='…'` for PITR). Start Postgres, verify row counts against
the pre-incident numbers, start `api`, run the §9 smoke test. Announce the data
window that was lost.

**Disk full.** Usual causes: Docker image accumulation (`docker image prune`),
the Caddy access log, or `AuditLog` growth — every state change on companies,
registrations, billing, payments, and documents writes one. Never delete WAL by
hand; let pgBackRest expire it.

**A customer paid and was not credited.** Check `UnmatchedTransfer` first — the
poller records a transfer it could not match to a pending `Payment` and warns
once. Then check the rate lock (`USDT_RATE_TTL_MINUTES`): a transfer arriving
after the quote expired is held deliberately, never credited at a stale rate.
Resolution is an admin action in `/admin/payments`, never a manual SQL update —
AGENTS.md forbids hand-editing the database, and the audit trail is the record.

**Emails not arriving.** SES sandbox (most common), a suppressed address after a
bounce, a missing/broken DKIM record, or the BullMQ queue backed up. Check the
notification queue depth before blaming SES.

**Secret leaked.** Rotate at the provider, update `/opt/marty/.env`,
`docker compose up -d api`, revoke old credentials, check Sentry and the audit
log for the exposure window. For `BETTER_AUTH_SECRET`, expect every user to be
signed out.

**Rolling back a destructive migration.** Restore the pre-deploy dump taken by
`deploy.sh`, then PITR forward to the moment before the migration ran. This is
the path the expand/contract rule exists to avoid needing.

---

## 18. Open decisions

1. Domain name confirmed as `martyglobal.com`? Everything in §3–§9 keys off it,
   and §4 makes the choice load-bearing rather than cosmetic.
2. Staging on the production box or its own? Plan assumes shared at launch.
3. arm64 (CAX) vs x86 (CPX) — depends on `ubuntu-24.04-arm` runner availability.
4. `p=quarantine` vs `p=reject` for DMARC. Start at `quarantine`, tighten after
   two weeks of clean reports.
5. Retention for the 7-year archive: confirm the actual regulatory requirement
   per filing jurisdiction rather than assuming seven.
6. Twilio: build the SMS half, or remove the channel from the UI before launch.
7. Whether to proxy `api` through Cloudflare later — requires the `trust proxy`
   change in §4 in the same PR.
