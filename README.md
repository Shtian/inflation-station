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

## Local Setup (Raspberry Pi Linux)

1. Install Node.js 20+ and pnpm:
   ```bash
   node -v
   pnpm -v
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Generate Prisma client:
   ```bash
   pnpm exec prisma generate
   ```
4. Apply migrations:
   ```bash
   pnpm exec prisma migrate deploy
   ```
5. Seed default data:
   ```bash
   pnpm db:seed
   ```
6. Start app:
   ```bash
   pnpm dev
   ```
7. Open `http://<raspberry-pi-ip>:3000` from another device on your network, or `http://localhost:3000` directly on the Pi.

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
- `pnpm exec tsc --noEmit`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`

## Routing

- `/` remains the legacy combined workspace while route-splitting is in progress.
- Top-level navigation links are available for `/overview`, `/import`, `/accounts`, and `/categories`.

## Theming

- Global semantic theme tokens are defined in `src/app/globals.css` using shadcn-compatible names (`background`, `foreground`, `card`, `muted`, `primary`, `accent`, `destructive`, `border`, `input`, `ring`).
- Shared UI primitives in `src/components/ui/*` should consume semantic token utilities (for example `bg-card`, `text-foreground`, `border-border`) instead of hardcoded palette classes.
