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

## Self-Hosting on Coolify

The app ships as a Docker image, `ghcr.io/shtian/inflation-station:latest`. Every instance runs the same image with its own volume and settings.

### Adding an instance

1. In Coolify, add a **Docker Image** resource with the image `ghcr.io/shtian/inflation-station:latest`.
2. Mount a persistent volume at `/data`, and set `DATABASE_URL=file:/data/data.db`.
3. Keep it at 1 replica. SQLite allows one writer, and each start migrates the database.
4. Set the runtime env vars from [`.env.schema`](.env.schema) that the instance needs, such as `OPENAI_API_KEY` and `TYPESAFE_API_KEY`. The container listens on port 3000.
5. Give each instance its own hostname. The app has no `basePath`, so it cannot run under a sub-path.
6. Add basic auth with Traefik labels, because the app has no login:
   ```
   traefik.http.middlewares.<name>-auth.basicauth.users=<user>:<htpasswd hash>
   traefik.http.routers.<router>.middlewares=<name>-auth
   ```
   Generate the hash with `htpasswd -nbB <user> <password>`, and double every `$` in it when the label goes through Docker Compose.

On every start the container creates the database directory, backs up an existing database to `/data/backups`, runs `prisma migrate deploy`, and then starts the server. To take a backup manually, run `scripts/backup-db.sh [output-dir]` in the container. It is safe to run while the app is running.

Anyone who can reach an instance's address can see its data, so keep the basic auth in place. The Spør chat (`/assistant`) also spends OpenAI tokens on the instance's `OPENAI_API_KEY` for anyone who can reach it, so authentication controls cost as well as privacy.

### Health check

`GET /api/health` runs `SELECT 1` against the database. It returns `200 {"status":"ok"}` when the query succeeds and `503 {"status":"error"}` when it fails. [`scripts/healthcheck.mjs`](scripts/healthcheck.mjs) calls it from inside the container, and the image's `HEALTHCHECK` runs that script.

Coolify ignores the image's `HEALTHCHECK` for a Docker Image resource. With its own check disabled, it treats a new container as healthy as soon as it starts and removes the old one. Enable the check on every instance under **Configuration → Healthcheck**:

- **Check type:** Container command
- **Command:** `node /app/scripts/healthcheck.mjs`
- **Interval:** 30, **Timeout:** 5, **Retries:** 3
- **Start period:** 60, so the backup and migrations finish before the first check

Don't use the **HTTP request** type. It runs `curl` or `wget` inside the container, and the image has neither.

With this check, Coolify keeps the running container until the new one turns healthy. If the new one never does, Coolify removes it, marks the deploy failed, and the old version keeps serving. This relies on Coolify's rolling update, which it skips when the app maps ports to the host or has a consistent container name, so leave both off.

### How releases reach Coolify

1. Merging the bumpy release PR tags `vX.Y.Z` and creates the GitHub release.
2. The same workflow builds the image and pushes `ghcr.io/shtian/inflation-station:X.Y.Z` and moves `:latest` to it. Nothing else pushes images.
3. Every 5 minutes a systemd timer on the VM runs [`scripts/coolify/deploy-poller.sh`](scripts/coolify/deploy-poller.sh). It reads the digest of `:latest` without pulling, and when it changed it asks Coolify's local API to deploy every configured app.

Coolify can't be reached from GitHub Actions and doesn't watch registries, which is why the VM polls.

The build reads the repository variables `VITE_SENTRY_DSN`, `SENTRY_ORG`, and `SENTRY_PROJECT` and the secret `SENTRY_AUTH_TOKEN`. All are optional. After the first release, make the `inflation-station` package public under the repo's **Packages** settings, so Coolify and the poller can pull it without credentials.

### Installing the deploy poller

On the VM, as root:

```bash
install -m 755 scripts/coolify/deploy-poller.sh /usr/local/bin/inflation-station-deploy-poller
install -m 644 scripts/coolify/inflation-station-deploy-poller.{service,timer} /etc/systemd/system/
install -d -m 700 /etc/inflation-station
install -m 600 /dev/null /etc/inflation-station/deploy-poller.env
```

Fill in `/etc/inflation-station/deploy-poller.env`:

```bash
# A Coolify API token with the deploy permission (Keys & Tokens → API tokens).
COOLIFY_TOKEN=...
# Comma-separated UUIDs of every app that runs the image.
COOLIFY_APP_UUIDS=uuid1,uuid2
# Optional, defaults to http://localhost:8000.
COOLIFY_URL=http://localhost:8000
```

Then start the timer and check a run:

```bash
systemctl daemon-reload
systemctl enable --now inflation-station-deploy-poller.timer
systemctl start inflation-station-deploy-poller.service
journalctl -u inflation-station-deploy-poller.service
```

The first run only records the current digest. Later runs deploy when it changes, and save the new digest only after Coolify accepts the deploy, so a failed call is retried on the next run. A failed run exits non-zero and shows up in `systemctl status inflation-station-deploy-poller.service`.

### Rolling back

In Coolify, set the app's image tag to an older `X.Y.Z` and redeploy. The poller leaves the app alone until `:latest` moves again, and then deploys whatever image the app is set to, so set the tag back to `latest` once the fix is released.

### Image notes

- The footer shows the version and the commit from the `SOURCE_COMMIT` build arg, since the image has no `.git`. Update an instance by deploying a newer image.
- The Feedback widget is unavailable, because the image has no `gh`. Leave `FEEDBACK_GITHUB_REPO` empty.

### Error Monitoring (Sentry)

Sentry is optional and off unless the image is built with `VITE_SENTRY_DSN`. The DSN, org, and project are build args, so they are baked into the image, not set per instance. The build reads `SENTRY_AUTH_TOKEN` from a BuildKit secret, which keeps it out of the public image, and uploads source maps when it is set. Set `SENTRY_ENVIRONMENT` per instance to tell instances apart; it defaults to `production`.

Errors, stack traces, a small sample of traces, and every AI chat are sent. AI calls include their prompts, answers, and tool results, which can contain transaction data, so Sentry's Agent Tracing shows full conversations. Request bodies, headers, cookies, and database values are not sent.

### Building the image locally

```bash
docker build -t inflation-station \
  --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" \
  --build-arg VITE_SENTRY_DSN=... --build-arg SENTRY_ORG=... --build-arg SENTRY_PROJECT=... \
  --secret id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
  .
docker run -p 3000:3000 -v inflation-station-data:/data \
  -e DATABASE_URL=file:/data/data.db inflation-station
```

The Sentry build args and the secret are optional.

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

## Optional Feedback Widget

Set `FEEDBACK_GITHUB_REPO=owner/name` (for example `Shtian/inflation-station`) alongside `OPENAI_API_KEY` to show a floating Feedback button on every page. It chats with the user about a bug or idea and, once they approve the draft, files a GitHub issue with the `gh` CLI, so run `gh auth login` on the host as the user that runs the app. The `bug`, `enhancement`, and `needs-triage` labels must exist in the target repo. The server reads it at boot, so restart the app after changing it. The Docker image has no `gh`, so the widget is unavailable there.

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
