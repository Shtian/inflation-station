import { parseArgs } from "node:util";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import {
  categorizeRowsWithJev,
  type JevCategoryOption,
} from "@/lib/categorization/jev-categorize";
import {
  buildJevEvalCases,
  formatJevEvalReport,
  type JevEvalCase,
  type JevEvalResult,
  singleRowOutcome,
} from "@/lib/categorization/jev-eval";
import { resolveDatabaseUrl } from "@/lib/database-url";

const DEFAULT_LIMIT = 50;
const CONCURRENCY = 12;

function parseLimit(): number | null {
  const { values } = parseArgs({
    options: { limit: { type: "string" } },
  });
  if (values.limit === undefined) return DEFAULT_LIMIT;

  const limit = Number(values.limit);
  return Number.isInteger(limit) && limit > 0 ? limit : null;
}

// One row per call so each outcome and latency is attributable to its case;
// categorizeRowsWithJev only reports outcomes as an aggregate.
async function evaluateCase(
  evalCase: JevEvalCase,
  categories: JevCategoryOption[],
): Promise<JevEvalResult> {
  const startedAt = performance.now();
  const { suggestions, outcomes } = await categorizeRowsWithJev({
    rows: [evalCase.row],
    categories,
  });
  const latencyMs = performance.now() - startedAt;
  const [suggestion] = suggestions;

  return {
    outcome: singleRowOutcome(outcomes),
    suggestion: suggestion
      ? { categoryId: suggestion.categoryId, confidence: suggestion.confidence }
      : null,
    latencyMs,
  };
}

async function evaluateAll(
  cases: JevEvalCase[],
  categories: JevCategoryOption[],
): Promise<JevEvalResult[]> {
  const results: JevEvalResult[] = new Array(cases.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < cases.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await evaluateCase(cases[index], categories);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, cases.length) }, worker),
  );
  return results;
}

async function main() {
  if (!process.env.TYPESAFE_API_KEY?.trim()) {
    console.error(
      "TYPESAFE_API_KEY is not set. The Jev eval calls the live TypeSafe API; export the key and rerun.",
    );
    process.exitCode = 1;
    return;
  }

  const limit = parseLimit();
  if (limit === null) {
    console.error("--limit must be a positive integer.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: resolveDatabaseUrl() }),
  });

  try {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, classifierHint: true },
      orderBy: { name: "asc" },
    });
    const transactions = await prisma.transaction.findMany({
      where: { categoryId: { not: null } },
      select: {
        normalizedMerchant: true,
        merchant: true,
        categoryId: true,
        bookingDate: true,
        amountNok: true,
        currency: true,
        paymentType: true,
      },
      orderBy: [{ bookingDate: "desc" }, { id: "asc" }],
    });

    const cases = buildJevEvalCases(
      transactions.flatMap(({ categoryId, amountNok, ...transaction }) =>
        categoryId
          ? [{ ...transaction, categoryId, amountNok: amountNok.toNumber() }]
          : [],
      ),
      limit,
    );
    const results = await evaluateAll(cases, categories);

    console.log(formatJevEvalReport({ cases, results, categories }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
