# DevContainer Setup Guide

This document tracks the setup steps for getting the Token Aggregator MVP running in a devcontainer environment.

## Quick Start (TL;DR)

After rebuilding or restarting the devcontainer:

```bash
# Wait for container to finish building/starting (~2-5 minutes)
# PostgreSQL, pnpm, dependencies, and schema are all automatic

# Populate database with provider data:
pnpm fetch:providers

# Start dev server (optional):
pnpm dev
```

**Note**: As of 2026-01-20, schema push now runs automatically on every container start via `postStartCommand`. PostgreSQL data is still not persisted across restarts, but the schema will be automatically recreated.

## Environment

- **Container**: Node.js 20 base image
- **User**: `node` (non-root)
- **Workspace**: `/workspace`
- **Package Manager**: pnpm v10.28.1

## Setup Steps Completed

### 1. Install pnpm

Since the devcontainer doesn't have pnpm pre-installed, we need to install it globally:

```bash
npm install -g pnpm
```

**Result**: pnpm v10.28.1 installed successfully.

### 2. Install Project Dependencies

Install all Node.js dependencies using pnpm:

```bash
CI=true pnpm install
```

**Note**: The `CI=true` environment variable is required in non-TTY environments (like devcontainers) to avoid interactive prompts during module recreation.

**Result**:
- ✅ 408 packages installed
- ✅ Effect language service patched TypeScript
- ✅ TypeScript compilation clean (0 errors)

## PostgreSQL Installation (Native - No Docker)

Instead of using Docker, we've configured PostgreSQL 16 to run natively inside the devcontainer.

### Changes Made

#### 1. Updated `.devcontainer/Dockerfile`

Added PostgreSQL 16 installation and configuration:

```dockerfile
# Install PostgreSQL 16
RUN apt-get update && apt-get install -y --no-install-recommends \
  lsb-release \
  wget \
  ca-certificates \
  && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
  && echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
  postgresql-16 \
  postgresql-client-16 \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configure PostgreSQL to run on port 5433 (to match project config)
RUN sed -i 's/port = 5432/port = 5433/g' /etc/postgresql/16/main/postgresql.conf

# Allow passwordless local connections for development
RUN echo "local   all             all                                     trust" > /etc/postgresql/16/main/pg_hba.conf && \
  echo "host    all             all             127.0.0.1/32            trust" >> /etc/postgresql/16/main/pg_hba.conf && \
  echo "host    all             all             ::1/128                 trust" >> /etc/postgresql/16/main/pg_hba.conf
```

#### 2. Created `.devcontainer/init-postgres.sh`

Initialization script that:
- Starts PostgreSQL on port 5433
- Creates `dev` user with password `dev`
- Creates `tokendb` database
- Runs automatically on container startup

#### 3. Updated `.devcontainer/devcontainer.json`

Added automatic setup commands:
- `postCreateCommand`: Installs pnpm, project dependencies, and applies database schema on first build
- `postStartCommand`: Starts PostgreSQL and configures firewall on every container start

#### 4. Updated `.devcontainer/init-firewall.sh`

Added all provider API domains to the firewall allowlist:

**Currently Operational:**
- `api.relay.link` - Relay
- `li.quest` - LiFi
- `across.to` - Across

**Ready for Implementation (9 additional providers):**
- `stargate.finance` - Stargate Finance
- `dln.debridge.finance` - DeBridge
- `price-api.mayan.finance` - Mayan
- `api.rhino.fi` - Rhino.fi
- `backend.gas.zip` - Gas.zip
- `api.aori.io` - Aori
- `eco.com` - Eco
- `relayer.meson.fi` - Meson
- `bs-tokens-api.chainservice.io` - Butter

**Supporting Services:**
- `chainid.network` - Chainlist (for chain metadata enrichment)
- `api.1inch.dev` - 1inch (future provider)

### Database Configuration

PostgreSQL will automatically start when the devcontainer starts. No manual intervention needed!

**Connection details**:
- Host: `localhost`
- Port: `5433`
- Database: `tokendb`
- User: `dev`
- Password: `dev`

### Manual Database Control

If you need to manually control PostgreSQL:

```bash
# Start PostgreSQL
sudo /usr/bin/pg_ctlcluster 16 main start

# Stop PostgreSQL
sudo /usr/bin/pg_ctlcluster 16 main stop

# Restart PostgreSQL
sudo /usr/bin/pg_ctlcluster 16 main restart

# Check status
pg_isready -p 5433

# Connect to database
psql -h localhost -p 5433 -U dev -d tokendb
```

## Post-Rebuild/Restart Steps

### On First Build (Container Creation)

The following happens automatically via `postCreateCommand`:

1. ✅ **pnpm installed** - Installed globally
2. ✅ **Dependencies installed** - All 408 packages
3. ✅ **Database schema applied** - `pnpm db:push` runs once

### On Every Container Start (Including Restarts)

The following happens automatically via `postStartCommand`:

1. ✅ **Firewall configured** - All provider domains allowed
2. ✅ **PostgreSQL started** - Started on port 5433
3. ✅ **Database initialized** - `dev` user and `tokendb` database created
4. ✅ **Schema applied** - `pnpm db:push` runs automatically (as of 2026-01-20)

### ⚠️ Known Limitation: Data Not Persisted

**Current Behavior**: PostgreSQL data directory (`/var/lib/postgresql/16/main`) is **not persisted** to a volume.

**Impact**:
- ✅ Schema automatically recreated on restart
- ❌ Token/chain data lost on restart (must run `pnpm fetch:providers` again)

**Why Not Persist?**: Keeps devcontainer fresh for testing, faster container rebuilds, avoids stale data issues.

**If You Want Persistence**: Add to `.devcontainer/devcontainer.json`:
```json
"mounts": [
  "source=claude-code-bashhistory-${devcontainerId},target=/commandhistory,type=volume",
  "source=claude-code-config-${devcontainerId},target=/home/node/.claude,type=volume",
  "source=token-aggregator-pgdata-${devcontainerId},target=/var/lib/postgresql/16/main,type=volume"
]
```

**Trade-off**: Persisted data means you need to manually clear database when schema changes.

### Manual Steps Required

After the automatic setup completes, you only need to:

#### 1. Populate Database with Provider Data

The database schema is automatically created but empty. Populate it with tokens/chains:

```bash
pnpm fetch:providers
```

**Expected output:**
```
✓ DeBridge complete: 24 chains, 16,712 tokens
✓ LiFi complete: 58 chains, 12,692 tokens
✓ Stargate complete: 96 chains, 2,157 tokens
✓ Across complete: 23 chains, 1,333 tokens
... (8 more providers)

Successes: 12
Failures: 0
```

This will take ~3-5 seconds and populate the database with 34,221 tokens from 12 providers.

#### 2. Start Development Server (Optional)

If you want to use the web UI:

```bash
pnpm dev
```

Then open http://localhost:3000 to view:
- Home dashboard with metrics
- Chains page with logos and metadata
- Tokens page with filtering and search
- Providers page with health status
- Conflicts page for data quality

### Quick Verification Commands

```bash
# Check PostgreSQL is running
pg_isready -p 5433
# Expected: localhost:5433 - accepting connections

# Check pnpm is installed
pnpm --version
# Expected: 10.28.1

# Check dependencies are installed
ls node_modules | wc -l
# Expected: 400+ directories

# Check database schema exists
psql -h localhost -p 5433 -U dev -d tokendb -c "\dt"
# Expected: 4 tables (chains, tokens, chain_provider_support, provider_fetches)
# If empty: Run `pnpm db:push`

# Check database has data
psql -h localhost -p 5433 -U dev -d tokendb -c "SELECT COUNT(*) FROM tokens;"
# Expected: 34,221 after running pnpm fetch:providers

# Check database has chains
psql -h localhost -p 5433 -U dev -d tokendb -c "SELECT COUNT(*) FROM chains;"
# Expected: 217 after running pnpm fetch:providers

# Check all 12 providers fetched successfully
psql -h localhost -p 5433 -U dev -d tokendb -c "SELECT provider_name, COUNT(*) FROM tokens GROUP BY provider_name ORDER BY COUNT(*) DESC;"
# Expected: 12 providers listed
```

## Environment Variables

Ensure `.env.local` exists with the following:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=tokendb
DATABASE_USER=dev
DATABASE_PASSWORD=dev
ADMIN_SECRET=dev-secret-token
```

Template available in `.env.example`.

---

## Summary

✅ **Working**: PostgreSQL 16 native installation on port 5433
✅ **Working**: Automatic pnpm + dependencies installation
✅ **Working**: Automatic schema push on every container start
✅ **Working**: Firewall configuration for all 12 provider APIs
✅ **Completed**: All 12 providers implemented (34,221 tokens, 217 chains)
⚠️ **By Design**: PostgreSQL data not persisted (fresh state on each restart)

**Recommended Workflow**:
1. Container starts → Wait for initialization (includes automatic schema push)
2. Run `pnpm fetch:providers` (populate data from all 12 providers)
3. Run `pnpm dev` (start web server on port 3000)

---

**Last Updated**: 2026-01-20
**Status**: All 12 providers operational, native PostgreSQL running
