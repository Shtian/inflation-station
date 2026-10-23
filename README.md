# Inflation Station

Local-first personal economy dashboard built with TanStack Start on Vite+, TypeScript, Prisma, and SQLite.

## Prerequisites

- Node.js 20+
- pnpm 12 (pinned via `packageManager`)
- Git

## Local Setup (macOS)

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create a `.env` that points at the local database (see [Configuration](#configuration)):
   ```
   DATABASE_URL=file:./prisma/dev.db
   ```
3. Generate Prisma client:
   ```bash
   pnpm exec prisma generate
   ```
4. Apply migrations to local SQLite:
   ```bash
   pnpm exec prisma migrate deploy
   ```
5. Seed default data:
   ```bash
   pnpm db:seed
   ```
6. Start development server:
   ```bash
   pnpm dev
   ```
7. Open `http://localhost:3000`.

## Configuration

[`.env.schema`](.env.schema) is the reference for every environment variable: its type, whether it is required, its default, and whether it is a secret. [Varlock](https://varlock.dev) loads it together with your gitignored `.env`, and values set in the process environment win over both. Secrets go in `.env` only.

- `pnpm dev` and `pnpm build` validate the config first and stop with an error when a required value is missing or invalid. Only `DATABASE_URL` is required.
- An empty or missing optional key turns its feature off: `OPENAI_API_KEY`, `TYPESAFE_API_KEY`, `FEEDBACK_GITHUB_REPO`, and `VITE_SENTRY_DSN`.
- `pnpm exec varlock load` prints the resolved config with secrets masked.
- App code reads config through the typed `ENV` from `varlock/env`. Its types are generated into the gitignored `env.d.ts`; `pnpm dev` and `pnpm build` regenerate it, or run `pnpm exec varlock codegen` before `pnpm typecheck` in a fresh checkout.
- The server reads `DATABASE_URL`, the OpenAI and TypeSafe keys and flags, and `FEEDBACK_GITHUB_REPO` when it boots, so restart it after a change. The Sentry values are baked into the build, so rebuild after a change.

## Self-Hosting (Raspberry Pi / Linux)

The app runs as a production build managed by pm2, served on port 3000 by default.

### Prerequisites

- Node.js 22.5+ (the database backup script uses `node:sqlite`)
- pnpm 12 (pinned via `packageManager`)
- pm2 (`npm install -g pm2`)
- Git

### First-time Setup

1. Clone the repo and enter the directory.
2. Create `.env` and set `DATABASE_URL` to a path **outside** the repo (so it survives pulls). [`.env.schema`](.env.schema) lists every other setting:
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

pm2 runs the build from `.releases/current`, a link to the latest release. The script only switches that link after a build succeeds, so a failed build leaves the running site untouched. The previous release is kept until the next deploy.

The footer also has an Update button that does the same from the browser. It runs `git pull --ff-only` and then `update.sh`, and skips the rebuild and restart when the pull brings nothing new. Output goes to `.update/update.log`. The button only appears under the pm2 process that `ecosystem.config.js` starts.

To take a backup manually, run `scripts/backup-db.sh [output-dir]`. It is safe to run while the app is running.

### Error Monitoring (Sentry)

Sentry is optional and off unless `VITE_SENTRY_DSN` is set in `.env`. The DSN is baked into the build, so run `bash update.sh` after changing it. To get readable stack traces, also set `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`; the build then uploads source maps. Errors, stack traces, a small sample of traces, and every AI chat are sent. AI calls include their prompts, answers, and tool results, which can contain transaction data, so Sentry's Agent Tracing shows full conversations. Request bodies, headers, cookies, and database values are not sent.

`update.sh` also reports a failed deploy to Sentry as one event, such as "Deploy failed at build (exit 137)", with the last 50 lines of the failed step's output. A failed migration sends only the step and the exit code, because migration errors can contain database values.

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

The Spør chat (`/assistant`) also spends OpenAI tokens on the instance's `OPENAI_API_KEY` for anyone who can reach it, so authentication at the reverse proxy controls cost as well as privacy.

### Feedback Widget

Set `FEEDBACK_GITHUB_REPO=owner/name` (for example `Shtian/inflation-station`) alongside `OPENAI_API_KEY` to show a floating Feedback button on every page. It chats with the user about a bug or idea and, once they approve the draft, files a GitHub issue with the `gh` CLI, so run `gh auth login` on the host as the user that runs the app. The `bug`, `enhancement`, and `needs-triage` labels must exist in the target repo. The server reads it at runtime, so restart the app after changing it (`bash update.sh`).

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

- Set the key in `.env` to enable AI suggestions:
  ```
  OPENAI_API_KEY=your_key_here
  ```
- If `OPENAI_API_KEY` is not set (or provider calls fail), imports still complete and rule-based categorization continues without failing the pipeline.

## Optional Jev (TypeSafe) API Key

Jev suggests a category for each imported row and helps guess which CSV columns hold the date, amount, description and payment type.

- Set the key in `.env` to enable Jev:
  ```
  TYPESAFE_API_KEY=your_key_here
  ```
- If `TYPESAFE_API_KEY` is not set, imports still complete: rows go to review without Jev's category suggestions, and the column-mapping step uses the built-in guesser alone.

### Evaluating Jev categorization

`pnpm eval:jev --limit 20` measures how well Jev picks categories, so a change to category hints, the prompt or the confidence floor can be compared with numbers. It needs `TYPESAFE_API_KEY` in `.env`, makes one live API call per case, and is not part of `pnpm test` or CI.

- Labels come from already-categorized transactions in `DATABASE_URL`, one per distinct merchant, most recent first. `--limit` caps the cases (default 50).
- Each case runs through the production `categorizeRowsWithJev`, including the confidence floor, with the categories and their classifier hints from the same database.
- Transactions do not store the import's name, title, sender or recipient. The eval sends `merchant` (or the normalized merchant) as the name and leaves the other three empty, so it is a little harder than a real import.
- The report counts suggested (correct and wrong), uncategorized, below floor and each unavailable reason, with p50 and max latency, then lists every wrong or missed row.

## Useful Commands

- `pnpm lint` (`vp check`: Oxfmt formatting and Oxlint)
- `pnpm lint:fix` (`vp check --fix`)
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:unit` (`vp test`)
- `pnpm test:e2e`
- `pnpm build`

## Routing

- `/` is the analytics dashboard landing route.
- Top-level navigation links are available for `/import`, `/transactions`, and configuration pages (`/accounts`, `/categories`).

## Theming

- Global semantic theme tokens use shadcn-compatible names (`background`, `foreground`, `card`, `muted`, `primary`, `accent`, `destructive`, `border`, `input`, `ring`).
- Shared UI primitives should consume semantic token utilities (e.g. `bg-card`, `text-foreground`, `border-border`) instead of hardcoded palette classes.
- Theme switching is managed with `next-themes` using the `html` class strategy.
