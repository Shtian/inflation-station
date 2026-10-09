# Inflation Station

Local-first personal economy dashboard built with Next.js, TypeScript, Prisma, and SQLite.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Git

## Local Setup (macOS)

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Generate Prisma client:
   ```bash
   pnpm exec prisma generate
   ```
3. Apply migrations to local SQLite:
   ```bash
   pnpm exec prisma migrate deploy
   ```
4. Seed default data:
   ```bash
   pnpm db:seed
   ```
5. Start development server:
   ```bash
   pnpm dev
   ```
6. Open `http://localhost:3000`.

## Self-Hosting (Raspberry Pi / Linux)

The app runs as a production build managed by pm2, served on port 3000 by default.

### Prerequisites

- Node.js 22.5+ (the database backup script uses `node:sqlite`)
- pnpm 10+
- pm2 (`npm install -g pm2`)
- Git

### First-time Setup

1. Clone the repo and enter the directory.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL` to a path **outside** the repo (so it survives pulls):
   ```
   DATABASE_URL=file:/path/to/data.db
   ```
   Optionally set `PM2_APP_NAME` (default `inflation-station`) and `PORT` (default `3000`).
3. Run the update script to install, migrate, build, and start:
   ```bash
   bash update.sh
   ```
4. Optionally save the pm2 process list to auto-start on reboot:
   ```bash
   pm2 save
   pm2 startup
   ```

The app will be reachable at `http://<host-ip>:<PORT>`.

### Updating

Pull the latest changes, then run the update script:

```bash
git pull origin main
bash update.sh
```

The script installs dependencies, backs up the database (to `<database dir>/backups`), runs migrations, rebuilds, and restarts pm2 automatically. The currently running build is displayed in the app footer.

To take a backup manually, run `scripts/backup-db.sh [output-dir]`. It is safe to run while the app is running.

### Running Multiple Instances

Each clone is a separate instance with its own database, so several people can run their own copy on the same machine. `ecosystem.config.js` runs the app from the folder it lives in and reads the pm2 name and port from that clone's `.env`.

1. Clone the repo into a second folder.
2. Give its `.env` a unique database path, pm2 name, and port:
   ```
   DATABASE_URL=file:/path/to/other-data/data.db
   PM2_APP_NAME=inflation-station-other
   PORT=3001
   ```
3. Run `bash update.sh` in that folder, then `pm2 save` so the new process starts on reboot.
4. Point your reverse proxy at the new port. Use a separate hostname rather than a sub-path; the app is not configured with a `basePath`.

Each clone's `update.sh` backs up, migrates, rebuilds, and restarts only its own instance, so update each clone separately.

The app has no login. Anyone who can reach an instance's address can see its data, so add authentication at the reverse proxy (for example Caddy's `basic_auth`) if instances should be private from each other.

## Prisma Migration and Seed Workflow

- Create migration while developing schema changes:
  ```bash
  pnpm db:migrate
  ```
- Regenerate client after schema changes:
  ```bash
  pnpm exec prisma generate
  ```
- Apply committed migrations in a clean environment:
  ```bash
  pnpm exec prisma migrate deploy
  ```
- Seed default data:
  ```bash
  pnpm db:seed
  ```

## Optional OpenAI API Key

OpenAI-based categorization suggestions are optional.

- Set key to enable AI suggestions:
  ```bash
  export OPENAI_API_KEY="your_key_here"
  ```
- If `OPENAI_API_KEY` is not set (or provider calls fail), imports still complete and rule-based categorization continues without failing the pipeline.

## Optional Jev (TypeSafe) API Key

Jev suggests a category for each imported row and helps guess which CSV columns hold the date, amount, description and payment type.

- Set key to enable Jev:
  ```bash
  export TYPESAFE_API_KEY="your_key_here"
  ```
- If `TYPESAFE_API_KEY` is not set, imports still complete: rows go to review without Jev's category suggestions, and the column-mapping step uses the built-in guesser alone.

## Useful Commands

- `pnpm lint`
- `pnpm lint:fix` (applies Biome lint/format/assist fixes via `biome check --write`)
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm build`

## Routing

- `/` is the analytics dashboard landing route.
- Top-level navigation links are available for `/import`, `/transactions`, and configuration pages (`/accounts`, `/categories`).

## Theming

- Global semantic theme tokens use shadcn-compatible names (`background`, `foreground`, `card`, `muted`, `primary`, `accent`, `destructive`, `border`, `input`, `ring`).
- Shared UI primitives should consume semantic token utilities (e.g. `bg-card`, `text-foreground`, `border-border`) instead of hardcoded palette classes.
- Theme switching is managed with `next-themes` using the `html` class strategy.
