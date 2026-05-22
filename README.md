# RupeeFast — Android App

> Digital Micro Loan Platform · Borrower + Investor + Agent

**Version:** 1.0.0 · **Min Android:** 7.0 (API 24) · **Target:** Android 14 (API 34)

---

## What's Inside

A complete 3-sided fintech Android app with **45+ screens** across three user roles:

### 🟦 Borrower App
- Mobile OTP login
- Active loan dashboard with progress tracker
- Trust Score (AI credit score) viewer
- Loan application with real-time calculator (₹2,000–₹50,000)
- Repayment plan selection (Daily / Weekly / Monthly)
- KYC flow (Aadhaar eKYC → PAN → Selfie → Bank Account Aggregator)
- AI credit scoring animation (47 signals)
- Loan offer accept / e-sign
- Daily payment flow (UPI AutoPay / Manual / Agent collect)
- Full repayment schedule (100-day calendar)
- Transaction history
- Loyalty levels (Starter → Bronze → Silver → Gold)
- Group Loan / SHG (5-member community loans)
- Referral program (₹100 per referral)
- AI chat assistant (Claude-powered)
- Notifications center
- Profile & settings

### 🟩 Investor App
- Portfolio dashboard (₹ invested, monthly returns, default rate)
- Investment calculator (auto-diversification across borrowers)
- Risk bucket selection (🟢 SAFE / 🟡 MODERATE / 🔴 HIGH RISK)
- Real-time repayment graph
- Withdrawal flow
- Monthly statements & tax certificates
- Referral program (₹500 per investor)
- Notifications
- Profile

### 🟧 Agent App
- Daily task dashboard (collections, verifications, acquisitions)
- Collection workflow (GPS stamp + borrower OTP confirm)
- Borrower verification flow
- Recovery task management
- Earnings tracker (₹ per task + commissions)
- New borrower acquisition referral
- Performance leaderboard
- Profile

---

## How to Build

### Prerequisites
- **Android Studio** Hedgehog or newer (2023.1+)
- **JDK 17** (bundled with Android Studio)
- **Android SDK** API 34

### Steps

1. **Open project in Android Studio**
   ```
   File → Open → select `rupeefast-android/` folder
   ```

2. **Sync Gradle**  
   Android Studio will auto-sync. If prompted, click **Sync Now**.

3. **Run on device/emulator**
   - Connect Android device (Enable USB Debugging in Developer Options)
   - Click ▶ **Run** or press `Shift+F10`

4. **Build APK (Debug)**
   ```
   Build → Build Bundle(s)/APK(s) → Build APK(s)
   ```
   Output: `app/build/outputs/apk/debug/RupeeFast-1.0.0-debug.apk`

5. **Build APK (Release)**
   - Add your keystore file to `app/` folder
   - Update `signingConfigs.release` in `app/build.gradle`
   - ```
     Build → Generate Signed Bundle/APK → APK → (select keystore)
     ```

### Command Line Build
```bash
# Debug APK
./gradlew assembleDebug

# Release APK  
./gradlew assembleRelease

# Output location
app/build/outputs/apk/debug/RupeeFast-1.0.0-debug.apk
```

---

## AI Chat Setup (Optional)

The AI chat screen uses the Claude API. To enable it:

1. Get an API key from https://console.anthropic.com
2. Open `app/src/main/assets/index.html`
3. Find the `getAIReply` function and add your key:
   ```javascript
   headers: {
     'Content-Type': 'application/json',
     'x-api-key': 'sk-ant-YOUR-KEY-HERE',
     'anthropic-version': '2023-06-01',
     'anthropic-dangerous-direct-browser-access': 'true'
   }
   ```
> ⚠️ For production, route API calls through your backend server — never expose API keys in client apps.

---

## App Architecture

```
MainActivity.java
  └── WebView (full screen, hardware accelerated)
       ├── file:///android_asset/index.html  (complete app UI)
       │    ├── Borrower screens (22 screens)
       │    ├── Investor screens (9 screens)
       │    └── Agent screens (11 screens)
       └── AndroidBridge (JS → Java)
            ├── onReady()
            ├── showToast(msg)
            └── vibrate()
```

**Why WebView?**  
The complete app UI is built in HTML/CSS/JS with pixel-perfect mobile design. The WebView approach:
- Preserves 100% of the original design fidelity
- Enables instant updates (just update `index.html`)
- Removes React Native/Flutter build complexity
- Works offline (all assets bundled)
- Full hardware acceleration enabled

---

## Screens List (45 total)

| # | Screen ID | Description |
|---|-----------|-------------|
| 1 | screen-home | Role selector splash |
| 2 | screen-b-login | Borrower login |
| 3 | screen-b-otp | OTP verification |
| 4 | screen-b-home | Borrower dashboard |
| 5 | screen-b-apply | Loan application + calculator |
| 6 | screen-b-kyc | KYC flow (4 steps) |
| 7 | screen-b-ai-score | AI credit scoring animation |
| 8 | screen-b-offer | Loan offer + e-sign |
| 9 | screen-b-score | Trust Score detail |
| 10 | screen-b-schedule | Repayment calendar |
| 11 | screen-b-pay | Payment flow |
| 12 | screen-b-history | Transaction history |
| 13 | screen-b-notif | Notifications |
| 14 | screen-b-loyalty | Loyalty levels + gamification |
| 15 | screen-b-referral | Referral program |
| 16 | screen-b-group | Group / SHG loans |
| 17 | screen-b-profile | Borrower profile |
| 18 | screen-b-settings | Settings & toggles |
| 19 | screen-b-ai | AI assistant chat |
| 20 | screen-i-login | Investor login |
| 21 | screen-i-home | Investor dashboard |
| 22 | screen-i-invest | Investment flow + risk buckets |
| 23 | screen-i-portfolio | Portfolio detail |
| 24 | screen-i-withdraw | Withdrawal flow |
| 25 | screen-i-statement | Monthly statement |
| 26 | screen-i-referral | Investor referral |
| 27 | screen-i-notif | Investor notifications |
| 28 | screen-i-profile | Investor profile |
| 29 | screen-a-login | Agent login |
| 30 | screen-a-home | Agent dashboard |
| 31 | screen-a-collect | Collection tasks |
| 32 | screen-a-verify | Verification tasks |
| 33 | screen-a-verify-detail | Borrower verification detail |
| 34 | screen-a-recovery | Recovery tasks |
| 35 | screen-a-recovery-detail | Recovery detail |
| 36 | screen-a-acquire | New borrower acquisition |
| 37 | screen-a-earnings | Agent earnings |
| 38 | screen-a-profile | Agent profile |

---

## Compliance Notes

> ⚠️ This is a UI prototype. Before going live, you must:

1. **RBI Registration** — Register as NBFC-P2P (min ₹2 Cr capital) or partner with licensed NBFC
2. **Data Privacy** — Implement DPDP Act 2023 consent flows for real data collection
3. **KYC APIs** — Integrate real Digilocker/Aadhaar/PAN verification APIs
4. **Payment Gateway** — Integrate Razorpay/Cashfree for real UPI AutoPay/NACH
5. **Account Aggregator** — Get Sahamati AA framework access
6. **Play Store** — Comply with Google Play's Financial Services policy (requires RBI license proof)

---

## Technology Stack (Production)
| Layer | Technology |
|-------|-----------|
| Mobile App | This Android app (WebView) |
| Backend API | Node.js + Python (FastAPI) |
| AI/ML | Python (credit scoring, fraud detection) |
| Database | PostgreSQL + Redis |
| Payments | Razorpay / Cashfree / Juspay |
| KYC | Digilocker + Aadhaar XML + Sahamati AA |
| Cloud | AWS / GCP (auto-scaling) |
| Communications | MSG91 / WhatsApp Business API |

---

*RupeeFast — Combine offline trust with online speed. That's the billion-dollar formula.*

---

## Deploy to Production

A comprehensive guide to deploying RupeeFast on a real server using Docker, a reverse proxy with SSL, and PM2 cluster mode.

> **⏱️ Estimated time:** 20–30 minutes for a fresh VPS

---

### Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Server | 1 GB RAM, 1 CPU | 2 GB RAM, 2 CPUs |
| OS | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 |
| Docker | 24+ | 27+ |
| Docker Compose | 2.20+ | 2.30+ |
| Domain name | — | `rupeefast.yourdomain.com` |
| SSL cert | — | Let's Encrypt (auto via Caddy) |

---

### Option 1: Docker Compose (Recommended)

This is the simplest path. Everything runs in containers with one command.

#### 1. Clone and configure

```bash
git clone https://github.com/your-org/rupeefast-android.git
cd rupeefast-android
```

Create a `.env` file in the project root with production values:

```bash
# Generate a strong JWT secret
cat /dev/urandom | head -c 64 | base64
# Copy that output and use it below

cat > .env << 'EOF'
JWT_SECRET=<paste-the-64-char-secret-here>
CORS_ORIGINS=https://rupeefast.yourdomain.com
EOF
```

If using Razorpay live keys, add them too:

```bash
echo "RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX" >> .env
echo "RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX" >> .env
echo "RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here" >> .env
```

#### 2. Start everything

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** — database with persistent volume (`pgdata`)
- **RupeeFast backend** — API server (port 3000) serving the frontend

#### 3. Verify

```bash
# Check services are healthy
docker compose ps

# Check application health
curl http://localhost:3000/api/health
# → { "status": "ok", "database": "connected", "uptime": 42, "timestamp": "..." }

# Open in browser
open http://localhost:3000
```

#### 4. Stopping

```bash
docker compose down          # Stop containers
docker compose down -v       # Stop + delete database volume
```

---

### Option 2: Manual Server Setup (No Docker)

For bare-metal or VPS deployments without Docker.

#### 1. Install dependencies

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-client

# Install PM2 globally for process management
sudo npm install -g pm2
```

#### 2. Set up PostgreSQL

```bash
sudo -u postgres psql -c "CREATE DATABASE rupeefast;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your-strong-password';"
```

#### 3. Configure the app

```bash
git clone https://github.com/your-org/rupeefast-android.git
cd rupeefast-android

# Install backend dependencies
cd backend
npm ci --omit=dev
cd ..

# Build frontend assets
node app/src/main/assets/build-html.js

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with production values
nano backend/.env
```

#### 4. Start with PM2

```bash
cd backend
NODE_ENV=production pm2 start ecosystem.config.js

# Save PM2 process list for automatic restart on reboot
pm2 save
sudo pm2 startup
```

---

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Set to `production` to enforce JWT_SECRET checks |
| `PORT` | No | `3000` | HTTP server port |
| `JWT_SECRET` | **Yes** | — | **Must be a strong random string in production.** Server crashes on startup if default is used. Generate with `openssl rand -base64 48` |
| `DATABASE_URL` | No | — | Postgres connection string (takes priority over individual vars) |
| `PGHOST` | No | `localhost` | Postgres host |
| `PGPORT` | No | `5432` | Postgres port |
| `PGDATABASE` | No | `rupeefast` | Postgres database name |
| `PGUSER` | No | `postgres` | Postgres user |
| `PGPASSWORD` | No | `postgres` | Postgres password |
| `PGPOOL_MAX` | No | `20` | Max pool connections |
| `PGPOOL_IDLE_TIMEOUT` | No | `30000` | Idle connection timeout (ms) |
| `PGPOOL_CONNECT_TIMEOUT` | No | `5000` | Connection timeout (ms) |
| `CORS_ORIGINS` | No | `http://localhost:3000,http://localhost:5173` | Comma-separated allowed origins |
| `RAZORPAY_KEY_ID` | No | — | Live key from Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | No | — | Live secret from Razorpay dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | No | `RAZORPAY_KEY_SECRET` fallback | Webhook signature verification secret |
| `LOGIN_RATE_LIMIT` | No | `5` | Max login attempts per 15 minutes |
| `GENERAL_RATE_LIMIT` | No | `60` | Max general API requests per minute |
| `PAYMENT_RATE_LIMIT` | No | `10` | Max payment endpoint requests per minute |
| `PM2_INSTANCES` | No | `max` | Number of PM2 cluster instances |
| `LOG_LEVEL` | No | `info` (prod) / `debug` (dev) | Log verbosity: `debug`, `info`, `warn`, `error` |
| `LOG_SHIP_ADDRESS` | No | — | Hostname of remote log aggregator (e.g., `logs.papertrailapp.com`) |
| `LOG_SHIP_PORT` | No | — | Port of remote log aggregator |
| `LOG_SHIP_MODE` | No | `tcp` | Transport protocol: `tcp` or `udp` |

---

### Centralized Log Shipping

RupeeFast uses **Pino** with the `pino-socket` transport to ship structured JSON logs to a remote aggregator. This enables centralized log management across all PM2 cluster instances.

#### How it works

- The logger always writes to **stdout** (JSON lines in production, pretty-printed in development)
- If `LOG_SHIP_ADDRESS` and `LOG_SHIP_PORT` are set, logs are **also** forwarded over TCP or UDP to a remote endpoint
- The socket transport automatically **reconnects** on connection loss (5s retry, indefinite)
- The server calls `logger.flush()` on graceful shutdown to ensure no buffered logs are lost

#### Configuration

Add these to your `.env` to ship logs:

```bash
# Log level (default: info in production, debug in development)
LOG_LEVEL=info

# Remote log aggregator (e.g., Papertrail, Logstash, syslog-ng)
LOG_SHIP_ADDRESS=logs.papertrailapp.com
LOG_SHIP_PORT=12345
LOG_SHIP_MODE=tcp          # tcp (default) or udp
```

#### Supported Destinations

| Service | Protocol | Example |
|---------|----------|---------|
| **Papertrail** | TCP | `logs.papertrailapp.com:12345` |
| **Logstash** | TCP (json_lines) | `logstash.internal:4560` |
| **syslog-ng / rsyslog** | TCP / UDP | `syslog.internal:514` |
| **Better Stack** | TCP | `in.logs.betterstack.com:12345` |
| **Grafana Loki** | TCP (via Promtail / syslog) | `loki.internal:1514` |
| **Datadog** | TCP (via syslog-ng agent) | `intake.logs.datadoghq.com:10514` |
| **Splunk HEC** | TCP (via syslog forwarder) | `splunk.internal:8088` |

> **Tip:** For production, install `pm2-logrotate` and pair it with a log shipping service for durable, searchable log archives.

#### Verifying log shipping

```bash
# Tail the local PM2 log stream — shipped logs go in parallel
pm2 logs rupeefast --lines 50

# Check that the startup message includes "Shipping logs to"
pm2 logs rupeefast | grep "Shipping logs"
# → [Logger] Shipping logs to logs.papertrailapp.com:12345 via tcp (reconnect enabled)

# Check the aggregator dashboard for incoming log entries
```

---

### SSL & Reverse Proxy

RupeeFast runs on port 3000. For production, place a reverse proxy in front to handle:
- **TLS termination** (HTTPS)
- **Domain routing**
- **DDoS protection** (optional)

#### Option A: Caddy (Simplest — Auto HTTPS)

[Caddy](https://caddyserver.com) automatically provisions and renews Let's Encrypt certificates with zero config.

**`Caddyfile`** (place in project root):

```caddyfile
rupeefast.yourdomain.com {
    reverse_proxy localhost:3000

    # Optional: security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Optional: rate limiting at proxy level
    rate_limit {
        zone dynamic {
            key {remote_host}
            events 100
            window 1m
        }
    }
}
```

```bash
# Start Caddy
caddy start
```

#### Option B: Nginx

**`/etc/nginx/sites-available/rupeefast`:**

```nginx
upstream rupeefast {
    least_conn;
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name rupeefast.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rupeefast.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/rupeefast.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rupeefast.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=rupeefast:10m rate=30r/s;
    limit_req zone=rupeefast burst=50 nodelay;

    # Body size limit (prevents large payload attacks)
    client_max_body_size 1m;

    location / {
        proxy_pass http://rupeefast;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeout for Razorpay webhook processing
        proxy_read_timeout 30s;
    }

    # Webhook endpoint needs raw body — Nginx passes it through unchanged
    location /api/webhooks/ {
        proxy_pass http://rupeefast;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 30s;
    }
}
```

Enable and obtain certs:

```bash
sudo ln -s /etc/nginx/sites-available/rupeefast /etc/nginx/sites-enabled/
sudo certbot --nginx -d rupeefast.yourdomain.com
sudo nginx -t && sudo systemctl reload nginx
```

---

### PM2 Process Management

When running without Docker, PM2 keeps the app alive, restarts on failure, and handles cluster mode.

#### Common commands

```bash
# Start / Stop / Restart
npm run start:cluster   # Start in cluster mode
npm run stop            # Gracefully stop
npm run restart         # Gracefully restart

# Monitor
npm run status          # List all processes
npm run logs            # Tail logs in real-time
npm run monit           # Dashboard (CPU, memory, loop delay)

# Log rotation (install separately)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

#### Cluster mode details

The `ecosystem.config.js` starts one worker per CPU core. Each worker:
- Shares port 3000 via PM2's built-in load balancer
- Is restarted if it exceeds 500 MB memory
- Has 12 seconds to shut down gracefully before PM2 force-kills
- Uses exponential backoff restart delay (100ms → 200ms → 400ms → ...)

Logs are written to `backend/logs/` with date-stamped entries.

---

### Production Checklist

Before going live, verify each item:

| # | Item | How to check |
|---|------|-------------|
| 1 | **JWT_SECRET is set** | `grep JWT_SECRET .env` — must not be the placeholder value |
| 2 | **NODE_ENV=production** | Server crashes on startup with default JWT_SECRET |
| 3 | **HTTPS is working** | Visit `https://yourdomain.com` — check lock icon in browser |
| 4 | **Helmet security headers** | `curl -I https://yourdomain.com` — check for `Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security` |
| 5 | **CORS is restricted** | Try `curl -H "Origin: https://evil.com" -I https://yourdomain.com` — should see no `Access-Control-Allow-Origin` header |
| 6 | **Rate limiting active** | Run `for i in {1..70}; do curl -s -o /dev/null -w '%{http_code}' https://yourdomain.com/api/health; done` — after 60 requests you should see `429` |
| 7 | **Health endpoint returns ok** | `curl https://yourdomain.com/api/health` — status should be `ok`, database should be `connected` |
| 8 | **Database persists across restarts** | `docker compose down && docker compose up -d` — data should be intact |
| 9 | **Graceful shutdown works** | `docker compose stop --timeout 15` — check logs for "Shutdown signal received. Closing gracefully..." |
| 10 | **Logs are being written** | `docker compose logs --tail=50` or `pm2 logs` — should see API request logs |
| 11 | **Database connections are pooled** | `PGPOOL_MAX` should match expected concurrent users. Default: 20 connections |
| 12 | **Razorpay webhooks reachable** | From Razorpay dashboard, test webhook ping to `https://yourdomain.com/api/webhooks/razorpay` |

---

### Maintenance

#### Database Migrations

RupeeFast uses a versioned SQL migration system. Every schema change is tracked in `backend/migrations/` as paired `.up.sql` / `.down.sql` files.

#### Migration commands

```bash
# Show applied / pending migrations
cd backend
npm run migrate:status

# Apply all pending migrations
npm run migrate:up

# Rollback the last migration (safe)
npm run migrate:down

# Rollback ALL migrations (⚠️ destructive — drops all tables)
npm run migrate:down:all

# Scaffold a new migration (creates NNNN_name.up.sql and .down.sql)
npm run migrate:create add_user_email
```

Example output of `npm run migrate:status`:
```
Migration Status

  Seq   Description                    Status     Applied At
  ────  ─────────────────────────────  ─────────  ───────────────────────
  0001  create_tables                  ✓ APPLIED  2025-05-17 12:34:56.789

  1 applied, 0 pending
```

#### How it works

- On **server startup**, `database.js` calls `runMigrations()` which checks the `_migrations` tracking table and runs any pending `.up.sql` files in sequence order.
- Each migration runs in **its own transaction** (`BEGIN`/`COMMIT`) — if it fails, the transaction is rolled back and the server logs the error.
- The system uses **sequence numbers** (`0001`, `0002`, …) for ordering. Always create a new migration rather than editing an existing one.
- **Down migrations** (`npm run migrate:down`) roll back one step by running the corresponding `.down.sql`.
- **Programmatic API** is exported as `{ runMigrations }`, callable directly from `database.js` on startup.

#### Migration best practices

| Rule | Why |
|------|-----|
| **Never edit an applied migration** — create a new one instead | Editing applied migrations breaks reproducibility; the checksum won't match |
| **Always write a down migration** | Ensures rollbacks are safe and predictable |
| **Use `IF NOT EXISTS` / `IF EXISTS`** | Makes migrations idempotent and safe to retry |
| **Add indexes alongside new columns** | Avoids full-table scans on existing large datasets |
| **Test down migrations in staging** | Verify that `migrate:down` + `migrate:up` restores identical schema |
| **Keep migrations small and focused** | One logical change per migration — easier to review and roll back |

#### Seed data for development

Migration `002_seed_data` populates the database with realistic sample data for local development and testing:

```bash
# Apply seed data (development only)
npm run migrate:up
```

**What gets seeded:**

| Table | Rows | Details |
|-------|------|---------|
| `users` | 8 | 3 borrowers (Ravi, Sneha, Arjun), 2 investors (Priya, Meera), 2 agents (Vikram, Deepak), 1 admin |
| `loans` | 5 | Mix of active, completed, and applied-with-mixed-repayment-plans (Daily/Weekly/Monthly) |
| `repayments` | 38 | 15 paid + 15 pending for Ravi's daily loan, 6 paid for completed loan, 2 paid for Sneha's weekly loan |
| `investments` | 4 | Safe/moderate/high risk buckets across 2 investors |
| `agent_tasks` | 6 | Completed verify/collect tasks and pending recovery/verify tasks |
| `payment_mandates` | 3 | UPI AutoPay and NACH mandates at various lifecycle stages |
| `transactions` | 17 | Completed repayments (AutoPay + agent-assisted), disbursals, investments |

> ⚠️ **Do not run this migration in production.** The seed data uses Indian mobile numbers for easy login during development.

Users can log in with any of the seeded mobile numbers (e.g., `9876543210` for Ravi) — OTP verification is mocked and always succeeds.

#### Creating your first custom migration

```bash
cd backend
npm run migrate:create add_user_email
```

Edit the generated files:

**`migrations/0002_add_user_email.up.sql`:**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

**`migrations/0002_add_user_email.down.sql`:**
```sql
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP COLUMN IF EXISTS email;
```

Apply it:
```bash
npm run migrate:up
```

---

### Database backups

```bash
# With Docker
docker exec rupeefast-db pg_dump -U postgres rupeefast > backup_$(date +%Y%m%d).sql

# Without Docker
pg_dump -U postgres rupeefast > backup_$(date +%Y%m%d).sql
```

#### Updating the app

```bash
# Docker
git pull
docker compose build --no-cache backend
docker compose up -d

# Manual
pm2 stop rupeefast
git pull
cd backend && npm ci --omit=dev
cd .. && node app/src/main/assets/build-html.js
pm2 start ecosystem.config.js
```

#### Monitoring

| Tool | Purpose |
|------|---------|
| `docker compose logs --tail=50 -f` | Real-time logs (Docker) |
| `pm2 monit` | CPU, memory, request loop delay |
| `GET /api/health` | Health check endpoint |
| `pm2 install pm2-logrotate` | Automatic log rotation |
| [Uptime Kuma](https://github.com/louislam/uptime-kuma) | External uptime monitoring (free) |
| [Better Stack](https://betterstack.com/logs) | Log aggregation & alerts |

---

### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `429 Too Many Requests` | Rate limit hit | Increase `GENERAL_RATE_LIMIT` / `LOGIN_RATE_LIMIT` in env |
| `401 Unauthorized` everywhere | JWT_SECRET changed | Generate new tokens or log users out |
| Health shows `database: disconnected` | PostgreSQL unreachable | Check `docker compose ps` and `PGHOST` env var |
| CORS errors in browser | Wrong `CORS_ORIGINS` | Include the exact origin (with protocol and port if any) |
| Blank page (no CSS) | CSP blocking CDN fonts | Check helmet CSP directives in server.js |
| PM2 cluster can't start | Port already in use | `kill $(lsof -t -i:3000)` then restart |
