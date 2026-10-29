# FamVacay Setup & Deployment Guide

This guide covers prerequisites, local development, production deployment via Docker Compose and Kubernetes, and reverse proxy configuration.

---

## 1. Prerequisites

- **Node.js:** Node 26 (Active LTS) or higher.
- **Package Manager:** `pnpm` (enable via `corepack enable`; the pinned version is read from the `packageManager` field in `package.json`).
- **PostgreSQL:** Version 15 or 16.
- **Cache Engine:** Valkey 8 or Redis 7.
- **Reverse Proxy:** An external TLS-terminating reverse proxy (Traefik, Nginx, Nginx Proxy Manager, Caddy, or Kubernetes Gateway).

---

## 2. Environment Variables Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | String | `development` | Runtime environment (`development`, `production`, `test`). |
| `PORT` | Number | `3000` | Port FamVacay listens on. |
| `APP_URL` | URL | `http://localhost:3000` | **Required in production.** The canonical public URL (`https://famvacay.us`). All redirects, OAuth callbacks, and canonical URLs derive from this. |
| `TRUST_PROXY` | Boolean | `false` | Set to `true` when running behind a trusted reverse proxy. Enables parsing of `X-Forwarded-*` and RFC 7239 `Forwarded` headers. |
| `TRUSTED_PROXY_HOPS` | Number | `1` | Number of trusted reverse proxy hops between client and application. Used to extract client IP safely from the right-most untrusted entry. |
| `DATABASE_URL` | String | (Required) | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/famvacay_db?schema=public`). |
| `VALKEY_URL` / `DRAGONFLY_URL` / `REDIS_URL` | String | `redis://localhost:6379` | Valkey / Dragonfly / Redis connection URL. Checked in that order; set whichever matches your cache engine (only one is required). |
| `NEXTAUTH_SECRET` | String | (Required in prod) | Cryptographic secret for signing sessions and JWTs (`openssl rand -base64 32`). In production, startup fails fast unless this is set, at least 32 characters, and not the literal placeholder from `.env.example`. |
| `NEXTAUTH_URL` | URL | `${APP_URL}` | Canonical NextAuth URL. |
| `ALLOWED_ORIGINS` | String | (Optional) | Comma-separated list of additional allowed Server Action origins (e.g. `famvacay.us,localhost:3000`). |
| `PHOTON_API_URL` | URL | `https://photon.komoot.io/api` | Geocoding autocomplete endpoint (default public Komoot or self-hosted Photon). |
| `OPEN_HOLIDAYS_API_URL` | URL | `https://openholidaysapi.org` | OpenHolidays API endpoint. |
| `NAGER_DATE_API_URL` | URL | `https://date.nager.at/api/v3` | Fallback public holiday API for regions outside OpenHolidays school break coverage. |
| `OPEN_METEO_ARCHIVE_URL` | URL | `https://archive-api.open-meteo.com/v1/archive` | Open-Meteo historical climate archive. |
| `GOOGLE_CLIENT_ID` | String | (Optional) | OAuth Client ID for Google login. |
| `GOOGLE_CLIENT_SECRET` | String | (Optional) | OAuth Client Secret for Google login. |
| `APPLE_CLIENT_ID` | String | (Optional) | OAuth Client ID for Apple login. |
| `APPLE_CLIENT_SECRET` | String | (Optional) | OAuth Client Secret for Apple login. |

---

## 3. Reverse Proxy Configuration

FamVacay serves plain HTTP on port `3000`. Your reverse proxy **must** terminate TLS, set `TRUST_PROXY=true`, and forward proxy headers accurately.

### 3.1 Traefik (v3)

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

### 3.2 Nginx

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

### 3.3 Nginx Proxy Manager (NPM)

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

### 3.4 Caddy (v2)

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

### 3.5 Pangolin (SASE / Tunneled Reverse Proxy)

Both the FamVacay application and the self-hosted Umami analytics service join the Docker network `proxy-network` (`${PROXY_NETWORK_NAME}`). Compose creates it automatically. If your reverse proxy already runs on an existing network of that name, start the stack with the override that marks it as external:

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d
```

Then configure:

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

## 4. Local Development

```bash
# 1. Clone repository
git clone https://github.com/NemesisRE/famvacay.git
cd famvacay

# 2. Install dependencies (enable Corepack once per machine if needed)
corepack enable
pnpm install --frozen-lockfile

# 3. Configure environment
cp .env.example .env

# 4. Generate Prisma client & apply database schema
pnpm exec prisma generate
pnpm exec prisma migrate dev

# 5. Start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## 5. Health & Monitoring Endpoints

- **Liveness:** `GET /api/health` — Returns `200 OK` if the process is up and running. Zero database or cache checks.
- **Readiness:** `GET /api/ready` — Returns `200 OK` if database and cache stores are reachable and ready to process traffic. Returns `503 Service Unavailable` during dependency outages.

