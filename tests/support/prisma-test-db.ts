import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../..",
);
const SCHEMA_PATH = path.join(REPO_ROOT, "prisma", "schema.prisma");
const PRISMA_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "prisma");
const TEMP_DB_DIR_PREFIX = path.join(tmpdir(), "inflation-station-test-db-");

/**
 * An isolated, migrated SQLite database backing a real Prisma client, plus
 * everything needed to tear it down again. Every call to
 * `createTestDatabase` gets its own uniquely-located temp file, so tests
 * using this harness are safe to run concurrently and never touch the
 * development database (`prisma/dev.db`).
 */
export type TestDatabase = {
  /** A real, adapter-backed Prisma client connected to this test database. */
  client: PrismaClient;
  /** The `file:` DATABASE_URL the client was created with. */
  databaseUrl: string;
  /** Absolute filesystem path to the SQLite database file. */
  databasePath: string;
  /** Directory containing the database file and its SQLite sidecar files. */
  databaseDir: string;
};

/**
 * Creates a uniquely-located temporary SQLite database, applies all
 * committed migrations to it (via `prisma migrate deploy`, never `db push`
 * or `migrate dev`), and returns a connected, adapter-backed `PrismaClient`
 * pointed at that same file.
 *
 * Foreign key enforcement is turned on for the connection (SQLite defaults
 * it off, and the driver adapter does not enable it), so cascade-delete and
 * FK-constraint behavior defined in `prisma/schema.prisma` is actually
 * exercised.
 *
 * Call `teardownTestDatabase` when done to disconnect the client and remove
 * the temp files.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const databaseDir = await mkdtemp(TEMP_DB_DIR_PREFIX);
  const databasePath = path.join(databaseDir, "test.db");
  const databaseUrl = `file:${databasePath}`;

  applyMigrations(databaseUrl);

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const client = new PrismaClient({ adapter });

  await client.$executeRawUnsafe("PRAGMA foreign_keys = ON;");

  return { client, databaseUrl, databasePath, databaseDir };
}

/**
 * Disconnects the client and removes the temp database directory, including
 * any SQLite sidecar files (`-journal`, `-wal`, `-shm`).
 */
export async function teardownTestDatabase(db: TestDatabase): Promise<void> {
  await db.client.$disconnect();
  await rm(db.databaseDir, { recursive: true, force: true });
}

function applyMigrations(databaseUrl: string): void {
  execFileSync(PRISMA_BIN, ["migrate", "deploy", "--schema", SCHEMA_PATH], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}

export type SqliteTriggerEvent = "INSERT" | "UPDATE" | "DELETE";

export type FailureTriggerOptions = {
  /** Table the trigger fires on, e.g. "ImportReviewRow". */
  table: string;
  /** Statement type that fires the trigger. */
  event: SqliteTriggerEvent;
  /** Message surfaced by the `RAISE(ABORT, ...)` when the trigger fires. */
  message: string;
  /**
   * Optional explicit trigger name. Defaults to a name derived from the
   * table and event, which is fine unless you install more than one trigger
   * on the same table/event pair in a single test.
   */
  triggerName?: string;
};

/**
 * Installs a test-only SQLite `TRIGGER ... RAISE(ABORT, ...)` on the given
 * table/event so that a matching write fails inside a transaction, letting
 * tests prove real rollback behavior instead of mocking failures.
 *
 * Not specific to any one table - pass whichever table/event a test needs
 * to force a failure on. Returns the trigger name so it can be passed to
 * `removeFailureTrigger`.
 */
export async function installFailureTrigger(
  client: PrismaClient,
  options: FailureTriggerOptions,
): Promise<string> {
  const triggerName =
    options.triggerName ?? defaultTriggerName(options.table, options.event);
  const escapedMessage = options.message.replace(/'/g, "''");

  await client.$executeRawUnsafe(
    `CREATE TRIGGER "${triggerName}" AFTER ${options.event} ON "${options.table}" ` +
      `BEGIN SELECT RAISE(ABORT, '${escapedMessage}'); END;`,
  );

  return triggerName;
}

/** Drops a trigger previously installed by `installFailureTrigger`. */
export async function removeFailureTrigger(
  client: PrismaClient,
  triggerName: string,
): Promise<void> {
  await client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}";`);
}

function defaultTriggerName(table: string, event: SqliteTriggerEvent): string {
  return `test_fail_${event.toLowerCase()}_${table.toLowerCase()}`;
}
