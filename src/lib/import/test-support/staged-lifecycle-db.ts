import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const prismaBinary = path.join(repoRoot, "node_modules", ".bin", "prisma");

export type TestPrismaClient = {
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
};

/**
 * Provisions a real, migrated, disposable SQLite database and a Prisma
 * client bound to it. Atomicity tests must observe genuine transaction
 * rollback behavior, which cannot be simulated by a mocked db client.
 */
export function createStagedLifecycleTestDb(): TestPrismaClient {
  const dir = mkdtempSync(path.join(tmpdir(), "import-lifecycle-test-"));
  const dbPath = path.join(dir, "test.db");
  const url = `file:${dbPath}`;

  execFileSync(prismaBinary, ["db", "push", "--accept-data-loss"], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  const adapter = new PrismaBetterSqlite3({ url });
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    async cleanup() {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
