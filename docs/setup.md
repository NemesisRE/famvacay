# FamVacay Setup & Deployment Guide

This guide covers a production deployment with Docker Compose or Kubernetes, every environment variable, reverse proxy configuration, updates and backups. For a quick look on your own machine, use the local quick start in the [README](../README.md#quick-start); for working on the code, see the [Development Guide](development.md).

---

## 1. Prerequisites

- **Docker Engine with Docker Compose v2**, or a Kubernetes cluster (see [5. Kubernetes](#5-kubernetes)).
- **A TLS-terminating reverse proxy** (Traefik, Nginx, Nginx Proxy Manager, Caddy, Pangolin, or a Kubernetes Ingress/Gateway). FamVacay itself serves plain HTTP only.
- **A domain** for the app, and optionally a second one for the Umami analytics dashboard.
- The services in `docker-compose.yml` bring everything else: PostgreSQL 16, Valkey 9 (any Redis-compatible cache works), the migration job and Umami.

Outbound internet access is needed at runtime: holiday calendars (OpenHolidays, Nager.Date), geocoding (Photon, OpenStreetMap Nominatim), driving times (OSRM), travel advisories and the background refresh of the reference data.

---

## 2. Production Deployment with Docker Compose

### 2.1 Configure

```bash
git clone https://github.com/NemesisRE/famvacay.git
cd famvacay
cp .env.example .env
```

Edit `.env`. At least these values must be set for a public instance:

| Variable | What to put in |
|---|---|
| `APP_URL`, `NEXTAUTH_URL` | Your public URL, e.g. `https://famvacay.example.org` |
| `ALLOWED_ORIGINS` | Your domain, e.g. `famvacay.example.org` |
| `NEXTAUTH_SECRET` | A random secret: `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | A random password (also used by Umami for its database) |
| `UMAMI_APP_SECRET` | A random secret: `openssl rand -base64 32` |
| `LEGAL_*` | Operator details for the imprint and privacy policy (see [3.4](#34-imprint--privacy-policy)) |
| `PROXY_NETWORK_NAME` | The Docker network of your reverse proxy (see [2.2](#22-proxy-network)) |
| `SMTP_*`, `MAIL_FROM` | Recommended: a mail server for confirmation links and passport reminders (see [2.5](#25-email-optional)) |

> [!CAUTION]
> Change the passwords **before the first start**. PostgreSQL stores `POSTGRES_PASSWORD` when it
> initializes its data volume; changing the variable later does not change the password in the
> database. The app refuses to start in production with the placeholder `NEXTAUTH_SECRET` from
> `.env.example`, and it logs a warning while `DATABASE_URL` still uses the default password.

### 2.2 Proxy network

The web app and Umami join an *external* Docker network that your reverse proxy is also attached to. Compose never creates external networks - `docker compose up` fails with `network proxy-network declared as external, but could not be found` until it exists. Either create it once per host:

```bash
docker network create proxy-network
```

or set `PROXY_NETWORK_NAME` in `.env` to the network your reverse proxy already uses (e.g. `traefik`, `pangolin`, `npm_default`). Deployment tools such as Komodo use the same `.env` value.

> [!WARNING]
> Production runs `docker-compose.yml` **alone**. Do not add `docker-compose.local.yml` (the
> README's local quick start): it publishes plain-HTTP ports on `127.0.0.1`, disables
> `TRUST_PROXY` and forces `APP_URL` to `http://localhost`.

### 2.3 Start

```bash
docker compose up -d
```

Compose pulls the released multi-arch images (`ghcr.io/nemesisre/famvacay` and `ghcr.io/nemesisre/famvacay-migrator`, tag `FAMVACAY_VERSION`, default `1` = the latest 1.x release) and starts, in order: PostgreSQL, `db-init` (creates Umami's database if it is missing), `migrate` (applies the Prisma migrations), Valkey, Umami and the web app. Both one-shot services exit with code 0 when they are done. `docker compose ps` shows the web app as `healthy` once `/api/ready` reaches the database and the cache.

Then point your reverse proxy at `famvacay-web:3000` (see [4. Reverse Proxy Configuration](#4-reverse-proxy-configuration)).

> [!TIP]
> To run your own changes, build from the checkout instead: `docker compose up -d --build`. Compose
> also falls back to building when an image cannot be pulled.

### 2.4 Set up Umami analytics (optional)

Analytics stay off until a website ID is configured.

1. Route a second domain (e.g. `analytics.example.org`) to `famvacay-umami:3000` in your reverse proxy.
2. Log in with Umami's default account `admin` / `umami` and **change the password right away**.
3. Add a website for your app domain and copy its *Website ID*.
4. Set `NEXT_PUBLIC_UMAMI_WEBSITE_ID` in `.env` and run `docker compose up -d` again.

The tracker is served first-party through the app (`/stats/*`), so visitors' browsers never contact the Umami domain. How visitors are asked depends on `NEXT_PUBLIC_COOKIE_BANNER_MODE` (see [3.5](#35-cookie-banner--analytics)).

### 2.5 Email (optional)

With a mail server configured, FamVacay

- sends a confirmation link after registration; the account settings show whether the address is confirmed,
- changes an account's address only after the new address confirmed it,
- mails passport reminders 6 months and 1 month before a passport stored in a family profile expires (only with the profile's passport check switched on, only to confirmed addresses).

Set `SMTP_HOST`, `MAIL_FROM` and, if your server needs a login, `SMTP_USER` / `SMTP_PASSWORD` (see [3.6](#36-email)), then `docker compose up -d` again. Port 587 requires STARTTLS, port 465 uses implicit TLS; plain-text SMTP is refused unless `SMTP_ALLOW_INSECURE=true`.

> [!NOTE]
> Without a mail server everything else works: addresses simply stay unconfirmed, address changes
> apply directly, and passport warnings appear only on the search results.

> [!IMPORTANT]
> Use a sender domain with SPF, DKIM and DMARC set up (most mail providers guide you through it),
> otherwise confirmation mails end up in spam. The privacy policy gains an email section
> automatically once mail is configured.

### 2.6 Updates

```bash
git pull                 # the compose file and scripts of the new release
docker compose pull      # the images of FAMVACAY_VERSION
docker compose up -d
```

The `migrate` service applies new database migrations on every start before the web app comes up. Read the [release notes](https://github.com/NemesisRE/famvacay/releases) before updating: breaking changes are listed there first.

> [!NOTE]
> Pin an exact release with `FAMVACAY_VERSION=1.2.3` in `.env` to update only when you choose to;
> the default `1` follows every 1.x release on `docker compose pull`. A new major version (`2`) is
> never pulled automatically.

### 2.7 Backups

All state lives in PostgreSQL (the cache can be lost at any time). Back up both databases, the app's and Umami's:

```bash
docker compose exec -T postgres pg_dump -U famvacay famvacay_db > famvacay_db.sql
docker compose exec -T postgres pg_dump -U famvacay famvacay_umami > famvacay_umami.sql
```

(Use your `POSTGRES_USER`, `POSTGRES_DB` and `UMAMI_DB` values if you changed them.)

> [!IMPORTANT]
> PostgreSQL major upgrades (16 → 17/18) cannot reuse the existing data volume. They need a dump,
> a fresh volume and a restore - which is why Renovate never proposes them automatically (see
> [Dependency Management](dependencies.md#postgresql-major-versions-17-18)).

---

## 3. Environment Variables Reference

Defaults are the application's own; where `docker-compose.yml` sets a different one, it is given as *Compose*.

### 3.1 Core

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` (Compose: `production`) | Runtime environment (`development`, `production`, `test`). |
| `PORT` | `3000` | Port FamVacay listens on. |
| `APP_URL` | `http://localhost:3000` | **Required in production.** The canonical public URL. Redirects, OAuth callbacks, passkey relying-party ID and canonical URLs derive from it. |
| `NEXTAUTH_URL` | `${APP_URL}` | Canonical NextAuth URL; keep it equal to `APP_URL`. |
| `NEXTAUTH_SECRET` | - | **Required in production.** Secret for signing sessions (`openssl rand -base64 32`). Startup fails unless it is set, at least 32 characters, and not the placeholder from `.env.example`. |
| `ALLOWED_ORIGINS` | - | Comma-separated additional allowed origins for Server Actions (e.g. `famvacay.example.org`). |
| `TRUST_PROXY` | `false` (Compose: `true`) | Set to `true` behind a trusted reverse proxy. Enables RFC 7239 `Forwarded` and `X-Forwarded-*` parsing. |
| `TRUSTED_PROXY_HOPS` | `1` | Number of trusted proxy hops; the client IP is taken from the right-most untrusted entry. |

### 3.2 Database & cache

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | - (Compose: built from `POSTGRES_*`) | PostgreSQL connection string. Compose sets it for the app, so `.env` only needs it outside Compose. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `famvacay` / `famvacay_secure_password` / `famvacay_db` | Compose only: credentials and database of the bundled PostgreSQL. Change the password before the first start. |
| `VALKEY_URL` / `DRAGONFLY_URL` / `REDIS_URL` | `redis://localhost:6379` (Compose: `redis://cache:6379`) | Cache connection. Checked in that order; set the one matching your cache engine. |

### 3.3 External services & data

| Variable | Default | Description |
|---|---|---|
| `OPEN_HOLIDAYS_API_URL` | `https://openholidaysapi.org` | School and public holiday calendars. |
| `NAGER_DATE_API_URL` | `https://date.nager.at/api/v3` | Public holidays for countries without OpenHolidays coverage. |
| `PHOTON_API_URL` | `https://photon.komoot.io/api` | Photon geocoder for the location and destination search. Point it at your own [Photon](https://github.com/komoot/photon) instance for heavy use or to keep searches on your own infrastructure. |
| `OSRM_BASE_URL` | `https://router.project-osrm.org` | Routing service for driving times (public OSRM demo server by default, or your own instance). |
| `OPEN_METEO_ARCHIVE_URL` | `https://archive-api.open-meteo.com/v1/archive` | Open-Meteo archive for the rain-duration data (free, non-commercial). |
| `OPEN_METEO_API_KEY` | - | Paid Open-Meteo plan. With `LEGAL_OPERATION_MODE=commercial`, new rain-duration data is only fetched with a key (from the customer endpoint). |
| `OPEN_METEO_CUSTOMER_ARCHIVE_URL` | `https://customer-archive-api.open-meteo.com/v1/archive` | Customer endpoint used with `OPEN_METEO_API_KEY`. |
| `DATASET_AUTO_REFRESH` | on in production | `false` keeps the reference data bundled in the image instead of refreshing it in the background. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | - | Google sign-in; enabled only when both are set. |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | - | Apple sign-in; enabled only when both are set. |

### 3.4 Imprint & privacy policy

The imprint (§5 DDG) and privacy policy (Art. 13/14 GDPR) are generated from these values. Unset values show a visible bracketed placeholder, so the build never fails - but a public instance must fill them in.

| Variable | Default | Description |
|---|---|---|
| `LEGAL_OPERATION_MODE` | `private` | `private` or `commercial`. Commercial operation also changes which free data sources may be used (Open-Meteo). |
| `LEGAL_OPERATOR_NAME` | placeholder | Name of the operator. |
| `LEGAL_OPERATOR_STREET` | placeholder | Street and house number. |
| `LEGAL_OPERATOR_POSTAL_CITY` | placeholder | Postal code and city. |
| `LEGAL_OPERATOR_COUNTRY` | `Deutschland / Germany` | Country. |
| `LEGAL_CONTACT_EMAIL` | `contact@example.invalid` | Contact email. |
| `LEGAL_CONTACT_PHONE` | - | Contact phone (optional). |
| `LEGAL_VAT_ID` | - | VAT ID (commercial operation). |
| `LEGAL_HOSTING_PROVIDER_NAME` / `LEGAL_HOSTING_PROVIDER_ADDRESS` | placeholder | Hosting provider named in the privacy policy. |
| `LEGAL_DPA_CONCLUDED` | `false` | `true` once a data processing agreement with the hosting provider is in place. |

> [!IMPORTANT]
> The generated texts are a starting point, not legal advice. Check them for your situation
> before you open the instance to the public.

### 3.5 Cookie banner & analytics

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_COOKIE_BANNER_MODE` | `TRANSPARENCY_AND_CHOICE` | `TRANSPARENCY_AND_CHOICE`: cookieless analytics run until a visitor opts out. `STRICT_OPT_IN`: analytics only after consent. `NONE`: no banner (analytics run; visitors can still opt out via the footer link). |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | - | Umami website ID; analytics are off while it is empty. Read at runtime, no rebuild needed. |
| `NEXT_PUBLIC_UMAMI_SCRIPT_URL` | `/stats/script.js` | Tracker script URL (first-party proxy path). |
| `UMAMI_INTERNAL_URL` | - (Compose: `http://umami:3000`) | Where the app's `/stats/*` proxy reaches Umami. |
| `UMAMI_APP_SECRET` | `changeme-umami-secret-min32chars` | Compose only: Umami's own secret. |
| `UMAMI_DB` | `famvacay_umami` | Compose only: Umami's database on the bundled PostgreSQL, created by `db-init`. |

### 3.6 Email

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | - | Mail server. Mail is off while it or `MAIL_FROM` is empty. |
| `SMTP_PORT` | `587` | `587` (STARTTLS, required) or `465` (implicit TLS). |
| `SMTP_SECURE` | `true` on port 465 | `true` for implicit TLS on another port. |
| `SMTP_USER` / `SMTP_PASSWORD` | - | Login, if the server needs one. |
| `MAIL_FROM` | - | Sender, e.g. `FamVacay <noreply@famvacay.example.org>`. |
| `SMTP_ALLOW_INSECURE` | `false` | `true` allows SMTP without TLS - only for a relay on your own network (e.g. Mailpit for testing). |

### 3.7 Docker Compose networking

| Variable | Default | Description |
|---|---|---|
| `FAMVACAY_VERSION` | `1` | Release of the app and migrator images to run: `1` follows the latest 1.x release, `1.2.3` pins one. |
| `PROXY_NETWORK_NAME` | `proxy-network` | Name of the **external** Docker network shared with your reverse proxy (the web app and Umami join it). It must exist before `docker compose up` - see [2.2](#22-proxy-network). |
| `WEB_PORT` / `UMAMI_PORT` | `3000` / `3001` | Host ports, used only by `docker-compose.local.yml` or after uncommenting the `ports:` entries in `docker-compose.yml` (for a reverse proxy running directly on the host). |

---

## 4. Reverse Proxy Configuration

FamVacay serves plain HTTP on port `3000`. Your reverse proxy **must** terminate TLS, keep `TRUST_PROXY=true`, and forward the proxy headers accurately.

> [!TIP]
> A reverse proxy in a container on the proxy network reaches the app as `famvacay-web:3000`.
> A proxy installed directly on the host (the Nginx and Caddy examples below use `127.0.0.1:3000`)
> needs a host port: uncomment the `ports:` entry of the `web` service in `docker-compose.yml`.

### 4.1 Traefik (v3)

```yaml
http:
  routers:
    famvacay:
      rule: "Host(`famvacay.us`)"
      entryPoints: ["websecure"]
      service: "famvacay-service"
      tls:
        certResolver: "letsencrypt"

  services:
    famvacay-service:
      loadBalancer:
        servers:
          - url: "http://famvacay-web:3000"
        passHostHeader: true
```

*Traefik automatically populates `X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto`.*

---

### 4.2 Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name famvacay.us;

    ssl_certificate /etc/letsencrypt/live/famvacay.us/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/famvacay.us/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Mandatory Forwarded Headers
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

### 4.3 Nginx Proxy Manager (NPM)

In the Nginx Proxy Manager UI:
1. **Details:**
   - Domain Names: `famvacay.us`
   - Scheme: `http`
   - Forward Hostname / IP: `famvacay-web` (or `127.0.0.1`)
   - Forward Port: `3000`
   - Enable: **Cache Assets**, **Block Common Exploits**, **Websockets Support**.
2. **SSL:**
   - Select your SSL Certificate.
   - Enable: **Force SSL**, **HTTP/2 Support**, **HSTS Enabled**.
3. **Advanced Tab (Custom Nginx Configuration):**
   ```nginx
   proxy_set_header X-Forwarded-Host $host;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   ```

---

### 4.4 Caddy (v2)

```caddyfile
famvacay.us {
    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Forwarded-Host {host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

### 4.5 Pangolin (SASE / Tunneled Reverse Proxy)

Both the FamVacay application and the self-hosted Umami analytics service join the external Docker network (`proxy-network` / `${PROXY_NETWORK_NAME}`):

1. **FamVacay Web Application**:
   - **Target Host**: `famvacay-web` (or `web`)
   - **Target Port**: `3000`
   - **Protocol**: HTTP
   - **Public Domain**: e.g., `famvacay.us`

2. **Umami Analytics Dashboard**:
   - **Target Host**: `famvacay-umami` (or `umami`)
   - **Target Port**: `3000`
   - **Protocol**: HTTP
   - **Public Domain**: e.g., `analytics.famvacay.us` or `umami.kurz.casa`

If using Pangolin's Newt connector with Docker labels, you can declare proxy resources directly in `docker-compose.yml` or bind a host port (`UMAMI_PORT=3001` in `.env`) if your proxy runs in host network mode.

---

## 5. Kubernetes

The manifests in `k8s/base/` (Kustomize, with a `production` overlay in `k8s/overlays/production/`) deploy the same stack: the web app (2 replicas, 3 in the `production` overlay) with a PodDisruptionBudget, the migration Job, PostgreSQL (StatefulSet), Valkey, Umami, a NetworkPolicy, and both an Ingress and a Gateway API `HTTPRoute` - keep the one your cluster uses.

1. **Images:** the manifests use the released `ghcr.io/nemesisre/famvacay` and `ghcr.io/nemesisre/famvacay-migrator` images (`linux/amd64` and `linux/arm64`). Change the version for both with an `images:` entry in your overlay. For your own build, push both `Dockerfile` targets (`runner`, `migrator`) to your registry and point the same `images:` entry at them.
2. **Configuration:** set your domain and the `LEGAL_*` values in `k8s/base/configmap.yaml` (or an overlay patch) and replace every placeholder in `k8s/base/secret.yaml` - better: create the secret from a secret manager instead of committing it.
3. **Umami database:** the PostgreSQL StatefulSet has no init scripts. Create Umami's database once before the first deploy:

   ```bash
   kubectl exec -it famvacay-postgres-0 -- psql -U famvacay -d famvacay_db -c 'CREATE DATABASE famvacay_umami;'
   ```

   With the `production` overlay, add `-n production` (the overlay deploys into that namespace).

4. **Deploy:** `kubectl apply -k k8s/overlays/production` (or `-k k8s/base` for the base alone). Run the migration Job again after every update, before rolling out the new web image.

> [!NOTE]
> The containers run as UID 10001 with a read-only root filesystem, no capabilities and
> `runAsNonRoot`; the NetworkPolicy only admits traffic to the web app on port 3000.

---

## 6. Local Development

See the [Development Guide](development.md) for running FamVacay from source with hot reload, the tests and the release process.

---

## 7. Health & Monitoring Endpoints

- **Liveness:** `GET /api/health` - `200 OK` while the process is up. No database or cache checks, so a database outage never restarts the app.
- **Readiness:** `GET /api/ready` - `200 OK` when PostgreSQL and the cache are reachable, `503 Service Unavailable` otherwise. Used by the Docker healthcheck and the Kubernetes readiness probe.
