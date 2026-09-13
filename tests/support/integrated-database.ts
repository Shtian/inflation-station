import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { CategoryKind, PaymentType, Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

/**
 * The database the integrated suite's Next server is started against. Relative
 * on purpose: Playwright runs `webServer` with the config file's directory as
 * its cwd, and Prisma resolves a `file:` URL against the process cwd, so the
 * server and this module land on the same file without either hard-coding an
 * absolute path.
 */
export const INTEGRATED_DATABASE_URL = "file:./prisma/integrated.db";

/**
 * The `lock` every integrated test declares. Tests sharing a lock name never
 * run concurrently, which is what makes truncate-and-lay-a-fixture safe on one
 * shared database.
 */
export const INTEGRATED_DB_LOCK = "integrated-db";

/** An account the fixture creates. `name` is unique across the database. */
export type FixtureAccount = {
  name: string;
  institution?: string;
};

/** A category the fixture creates. `name` is unique across the database. */
export type FixtureCategory = {
  name: string;
  /** Defaults to the schema's `EXPENSE`. */
  kind?: CategoryKind;
};

export type FixtureTransaction = {
  /** `name` of an account declared in the same fixture. */
  account: string;
  /**
   * `name` of a category declared in the same fixture. Omitted leaves the row
   * uncategorised, which the table renders as `Uncategorized`.
   */
  category?: string;
  /** `YYYY-MM-DD`, read back as the UTC calendar day. */
  bookingDate: string;
  /** Negative for spending, positive for income. */
  amountNok: number;
  /** The display value shown in the Merchant column. */
  merchant: string;
  /**
   * The stored merchant search key. Defaults to the key `merchant` normalises
   * to. Set it to something else to lay down a row whose key disagrees with its
   * merchant. That is the state a row written before the search-key fix is in,
   * and one no write path can produce any more.
   */
  searchKey?: string;
  /** Defaults to the schema's `OTHER`. */
  paymentType?: PaymentType;
  /** Omitted leaves the row without a note, which renders no note indicator. */
  note?: string;
};

/**
 * The complete contents of the integrated database for one test. Transactions
 * name their account and category rather than carrying ids, so a spec can state
 * its rows in one literal.
 */
export type TransactionFixture = {
  accounts: readonly FixtureAccount[];
  categories?: readonly FixtureCategory[];
  transactions: readonly FixtureTransaction[];
};

const FIXTURE_CURRENCY = "NOK";
const DEVELOPMENT_DATABASE_FILENAME = "dev.db";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolves a Prisma `file:` URL to the absolute path it opens, the same way
 * Prisma does: relative to the current working directory. Deriving it from this
 * module's own location instead would let the guard vet a different file from
 * the one a connection would open.
 */
export function resolveSqliteFilePath(databaseUrl: string): string {
  const withoutScheme = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;

  return path.resolve(process.cwd(), withoutScheme);
}

/**
 * The last line of defence against a misconfigured run destroying local data.
 * Everything this module does starts by deleting every row, so it must never
 * find itself pointed at the development database.
 */
export function assertNotDevelopmentDatabase(databaseUrl: string): void {
  const filePath = resolveSqliteFilePath(databaseUrl);

  if (path.basename(filePath) !== DEVELOPMENT_DATABASE_FILENAME) {
    return;
  }

  throw new Error(
    [
      "Refusing to truncate the development database.",
      `  DATABASE_URL: ${databaseUrl}`,
      `  resolves to:  ${filePath}`,
      "The integrated fixture helper deletes every row before it lays a fixture,",
      "so it only operates on a disposable database. Point it at",
      `${INTEGRATED_DATABASE_URL} (the \`integrated\` webServer entry in`,
      "playwright.config.ts sets that as DATABASE_URL) and re-run.",
    ].join("\n"),
  );
}

/**
 * Truncates every table and inserts exactly `fixture`, so the test that calls
 * it depends on no other test's data and on no part of the demo dataset.
 *
 * Writes go through Prisma directly rather than the API or the UI: setup must
 * not route through the code under test, and a fixture needs to be able to
 * build rows the write path can no longer produce.
 *
 * `databaseUrl` exists so this module's own tests can point it at a temporary
 * database. Specs leave it alone.
 */
export async function layFixture(
  fixture: TransactionFixture,
  databaseUrl: string = INTEGRATED_DATABASE_URL,
): Promise<void> {
  assertNotDevelopmentDatabase(databaseUrl);

  const client = await connect(databaseUrl);

  try {
    await truncateAll(client);

    const accountIds = new Map<string, string>();
    for (const account of fixture.accounts) {
      const created = await client.account.create({
        data: { name: account.name, institution: account.institution },
      });
      accountIds.set(account.name, created.id);
    }

    const categoryIds = new Map<string, string>();
    for (const category of fixture.categories ?? []) {
      const created = await client.category.create({
        data: { name: category.name, kind: category.kind },
      });
      categoryIds.set(category.name, created.id);
    }

    for (const transaction of fixture.transactions) {
      await client.transaction.create({
        data: toTransactionData(transaction, accountIds, categoryIds),
      });
    }
  } finally {
    await client.$disconnect();
  }
}

async function connect(databaseUrl: string): Promise<PrismaClient> {
  const client = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });

  // The live server holds this same file open while a fixture is laid, so the
  // writer must not block its readers. WAL is persisted in the file header, so
  // setting it here is idempotent.
  await client.$executeRawUnsafe("PRAGMA journal_mode = WAL;");
  await client.$executeRawUnsafe("PRAGMA busy_timeout = 10000;");
  await client.$executeRawUnsafe("PRAGMA foreign_keys = ON;");

  return client;
}

async function truncateAll(client: PrismaClient): Promise<void> {
  // Ordered so no delete orphans a row that still references it. With
  // `PRAGMA foreign_keys = ON` a wrong order fails loudly rather than silently.
  await client.$transaction([
    client.categorizationSuggestion.deleteMany(),
    client.importReviewRow.deleteMany(),
    client.importReviewSession.deleteMany(),
    client.transaction.deleteMany(),
    client.categoryRule.deleteMany(),
    client.category.deleteMany(),
    client.account.deleteMany(),
    client.monthlyReview.deleteMany(),
    client.monthlyReviewSystemPrompt.deleteMany(),
    client.messageCleanupSettings.deleteMany(),
    client.importProviderFieldMapping.deleteMany(),
    client.importProviderMapping.deleteMany(),
  ]);
}

function toTransactionData(
  transaction: FixtureTransaction,
  accountIds: ReadonlyMap<string, string>,
  categoryIds: ReadonlyMap<string, string>,
): Prisma.TransactionUncheckedCreateInput {
  return {
    accountId: resolveName(accountIds, transaction.account, "account"),
    categoryId:
      transaction.category === undefined
        ? null
        : resolveName(categoryIds, transaction.category, "category"),
    bookingDate: toUtcDay(transaction.bookingDate),
    amountNok: transaction.amountNok,
    currency: FIXTURE_CURRENCY,
    merchant: transaction.merchant,
    normalizedMerchant:
      transaction.searchKey ?? deriveSearchKey(transaction.merchant),
    paymentType: transaction.paymentType,
    note: transaction.note ?? null,
  };
}

function resolveName(
  ids: ReadonlyMap<string, string>,
  name: string,
  kind: "account" | "category",
): string {
  const id = ids.get(name);

  if (id === undefined) {
    throw new Error(
      `Fixture transaction names the ${kind} "${name}", which the fixture does not declare. ` +
        `Declared ${kind}s: ${[...ids.keys()].map((known) => `"${known}"`).join(", ") || "none"}.`,
    );
  }

  return id;
}

function toUtcDay(bookingDate: string): Date {
  if (!ISO_DATE_PATTERN.test(bookingDate)) {
    throw new Error(
      `Fixture bookingDate "${bookingDate}" is not YYYY-MM-DD. The table renders ` +
        "the UTC calendar day of this value verbatim, so state it in that form.",
    );
  }

  return new Date(`${bookingDate}T00:00:00.000Z`);
}

/**
 * Re-states `normalizeMerchantKey`'s rule rather than importing it. A fixture
 * that derived its key by calling the code under test could not fail when that
 * code is wrong.
 */
function deriveSearchKey(merchant: string): string {
  return merchant
    .replaceAll(/[æÆ]/g, "ae")
    .replaceAll(/[øØ]/g, "o")
    .replaceAll(/[åÅ]/g, "a")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}
