# DevContainer Configuration

This devcontainer is configured with PostgreSQL 16 running natively (no Docker required).

## What's Included

- **Node.js 20**: Base runtime environment
- **PostgreSQL 16**: Database server on port 5433
- **pnpm**: Package manager (auto-installed)
- **Development Tools**: git, gh, zsh, vim, nano, jq, etc.
- **Effect Language Service**: TypeScript plugin for Effect-TS

## Automatic Setup

When you build/rebuild the devcontainer:

1. **Build time** (Dockerfile):
   - Installs PostgreSQL 16
   - Configures it to run on port 5433
   - Sets up passwordless local authentication

2. **First build** (postCreateCommand):
   - Installs pnpm globally
   - Runs `pnpm install` to install project dependencies

3. **Every start** (postStartCommand):
   - Starts PostgreSQL server
   - Creates `dev` user and `tokendb` database (if they don't exist)
   - Initializes firewall rules

## Files

- `Dockerfile` - Main container configuration with PostgreSQL 16 installation
- `devcontainer.json` - VS Code devcontainer settings and lifecycle commands
- `init-postgres.sh` - PostgreSQL startup and initialization script
- `init-firewall.sh` - Firewall configuration script

## Database Connection

After the devcontainer starts, PostgreSQL is ready to use:

```
Host: localhost
Port: 5433
Database: tokendb
User: dev
Password: dev
```

## Next Steps

After the devcontainer is built and started:

1. Verify PostgreSQL: `pg_isready -p 5433`
2. Apply migrations: `pnpm db:push`
3. Start dev server: `pnpm dev`
4. Run provider fetch: `pnpm fetch:providers`

## Rebuilding

To rebuild the devcontainer with these changes:

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Select "Dev Containers: Rebuild Container"
3. Wait for build to complete (~2-5 minutes)
4. PostgreSQL will start automatically

## Troubleshooting

If PostgreSQL isn't running:
```bash
sudo /usr/local/bin/init-postgres.sh
```

If you need to restart PostgreSQL:
```bash
sudo /usr/bin/pg_ctlcluster 16 main restart
```

Check PostgreSQL logs:
```bash
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```
