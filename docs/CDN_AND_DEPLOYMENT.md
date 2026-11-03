# CDN, Auto-Scaling & Production Deployment Guide

This documentation details the architecture, CDN edge-caching setup, server-side load balancing, auto-scaling mechanisms, and enterprise security configurations implemented for this project.

---

## 1. Content Delivery Network (CDN) Architecture

The application is engineered to operate seamlessly behind global CDN providers like **Cloudflare**, **AWS CloudFront**, or **Fastly**.

### Cache-Control Header Strategy
Static assets served from the `/public` directory (CSS, JS, WebP, SVG, Favicons) emit immutable caching headers:
```http
Cache-Control: public, max-age=31536000, immutable
ETag: W/"..."
```
Dynamic pages (Home, Services, Contact) emit cache validation headers:
```http
Cache-Control: public, max-age=0, must-revalidate
```

### Cloudflare Edge Configuration
1. **SSL/TLS Mode**: Set to **Full (Strict)**.
2. **Always Use HTTPS**: Enable (enforces redirect at edge before hitting origin).
3. **HTTP/2 & HTTP/3 (QUIC)**: Enable for multiplexing and faster mobile round-trips.
4. **Brotli & Early Hints**: Enable.
5. **Page Rules / Cache Rules**:
   - URL: `apexdigital.example/css/*` -> Edge Cache TTL: 1 Month, Cache Level: Cache Everything.
   - URL: `apexdigital.example/js/*` -> Edge Cache TTL: 1 Month, Cache Level: Cache Everything.
   - URL: `apexdigital.example/api/*` -> Bypass Cache.

---

## 2. Server-Side Load Balancing & Auto-Scaling

Two independent, complementary scaling layers are built into this project:

### Layer A: In-Process Multi-Core Auto-Scaling (`src/cluster.ts`)
Node.js processes run on a single thread by default. `src/cluster.ts` inspects the host hardware via `os.cpus().length` and forks a dedicated worker process for each core:
- Auto-Healing: If a worker encounters an unexpected crash or OOM, the primary process catches the `exit` signal and instantly spawns a replacement worker with zero user-perceived downtime.
- Rolling Reload: Send `SIGUSR2` to trigger sequential worker restarts without dropping active HTTP connections.

```bash
# Run in multi-core cluster mode
npm run start:cluster
```

### Layer B: Container-Level Load Balancing with Nginx (`docker-compose.yml`)
The included `docker-compose.yml` configures an Nginx reverse proxy distributing traffic across three application replicas (`app1`, `app2`, `app3`) using the `least_conn` load balancing algorithm:
```nginx
upstream app_cluster {
    least_conn;
    server app1:3000 max_fails=3 fail_timeout=10s;
    server app2:3000 max_fails=3 fail_timeout=10s;
    server app3:3000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}
```
Each container is assigned CPU and memory limits (`0.50 CPU`, `384M RAM`) and healthcheck probes monitoring `http://localhost:3000/health`.

---

## 3. Security Hardening Implementation Matrix

| Requirement | Implementation Component | Verification Mechanism |
|---|---|---|
| **Enforce HTTPS** | `src/middleware/security.ts` (`enforceHttps`), HSTS header (2 years, preload) | 301 Permanent Redirect on non-HTTPS requests |
| **Content Security Policy (CSP)** | `helmet.contentSecurityPolicy` in `security.ts` | Strict script, style, img, font directives; prevents unauthorized script injection |
| **X-Frame-Options** | `helmet.xFrameOptions({ action: 'deny' })` | `X-Frame-Options: DENY` blocks clickjacking |
| **X-Content-Type-Options** | `helmet.xContentTypeOptions()` | `nosniff` prevents MIME-type confusion attacks |
| **Input Sanitization** | `validator.escape`, whitespace trimming, null-byte stripping in `src/utils/sanitizer.ts` | Unit tests verify XSS vectors are neutralized |
| **Parameterized Queries** | `better-sqlite3` prepared statements (`db.prepare(...)`) in `src/database/db.ts` | SQL injection strings (e.g. `' OR 1=1; DROP TABLE`) are stored as harmless text |
| **CSRF Protection** | Cryptographically signed HMAC-SHA256 double-submit cookie tokens in `src/middleware/csrf.ts` | Mutating requests (`POST /api/contact`) without or with invalid tokens return HTTP 403 |
| **Spam & Bot Defense** | Hidden honeypot field (`website_url_hp`) + submission velocity check (< 1.5s) | Automated scripts are instantly detected and rejected with HTTP 400 |
| **Dependency Updates** | `.github/dependabot.yml` + `npm audit --audit-level=high` in CI | Weekly scans and automated pull requests for outdated packages |

---

## 4. Error Monitoring & Observability

- **Structured Logging**: Uses `pino` and `pino-http`. Emits structured JSON in production with automatic redaction of cookies, authorization headers, and secrets.
- **Request Tracing**: Generates or propagates `X-Request-Id` through every log entry.
- **Health Probes**: `GET /health` provides real-time database connectivity and memory telemetry.
- **Metrics**: `GET /metrics` tracks total inquiries, analytics counts, uptime, and CPU usage.
