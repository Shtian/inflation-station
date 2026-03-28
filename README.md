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

The app runs as a production build managed by pm2, served on port 3000.

### Prerequisites

- Node.js 20+
- pnpm 10+
- pm2 (`npm install -g pm2`)
- Git

### First-time Setup

1. Clone the repo and enter the directory.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL` to a path **outside** the repo (so it survives pulls):
   ```
   DATABASE_URL=file:/path/to/data.db
   ```
3. Update `ecosystem.config.js` so `cwd` points to your local clone path.
4. Run the update script to install, migrate, build, and start:
   ```bash
   bash update.sh
   ```
5. Optionally save the pm2 process list to auto-start on reboot:
   ```bash
   pm2 save
   pm2 startup
   ```

The app will be reachable at `http://<host-ip>:3000`.

### Updating

Pull the latest changes, then run the update script:

```bash
git pull origin main
bash update.sh
```

The script installs dependencies, runs migrations, rebuilds, and restarts pm2 automatically.

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

## Useful Commands

- `pnpm lint`
- `pnpm lint:fix` (applies Biome lint/format/assist fixes via `biome check --write`)
- `pnpm exec tsc --noEmit`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm build`

## Routing

- `/` is the analytics dashboard landing route.
- Top-level navigation links are available for `/import`, `/transactions`, and configuration pages (`/import-provider-mappings`, `/accounts`, `/categories`).

## Theming

- Global semantic theme tokens use shadcn-compatible names (`background`, `foreground`, `card`, `muted`, `primary`, `accent`, `destructive`, `border`, `input`, `ring`).
- Shared UI primitives should consume semantic token utilities (e.g. `bg-card`, `text-foreground`, `border-border`) instead of hardcoded palette classes.
- Theme switching is managed with `next-themes` using the `html` class strategy.
