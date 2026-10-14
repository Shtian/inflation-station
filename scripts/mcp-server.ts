import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createAssistantQueries } from "@/lib/assistant/queries";
import { SEARCH_LIMIT_MAX } from "@/lib/assistant/search";
import { resolveDatabaseUrl } from "@/lib/database-url";
import packageJson from "../package.json";

const isoDate = z.string().describe("Local calendar day, YYYY-MM-DD.");
const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

async function respond(run: () => Promise<unknown>) {
  try {
    const result = await run();
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: resolveDatabaseUrl() }),
  });
  const queries = createAssistantQueries({ db });
  const server = new McpServer({
    name: "inflation-station",
    version: packageJson.version,
  });

  server.registerTool(
    "summarizeSpending",
    {
      description:
        'Total spend in NOK between two local calendar days (YYYY-MM-DD, both inclusive), grouped by category, merchant, month, or account. Spend is money out, reported as a positive NOK number; transfers and income are excluded, uncategorized spend is kept. To filter by category, call listCategories first and pass ids. Resolve relative periods like "last month" to exact dates yourself, and tell the user the `range` the result echoes.',
      inputSchema: {
        from: isoDate,
        to: isoDate,
        groupBy: z.enum(["category", "merchant", "month", "account"]),
        categoryIds: z
          .array(z.string())
          .optional()
          .describe("Only these category ids (see listCategories)."),
        accountIds: z
          .array(z.string())
          .optional()
          .describe("Only these account ids (see listAccounts)."),
        merchantQuery: z
          .string()
          .optional()
          .describe("Substring match on the merchant name."),
      },
      annotations: READ_ONLY,
    },
    (input) => respond(() => queries.summarizeSpending(input)),
  );

  server.registerTool(
    "searchTransactions",
    {
      description: `Find individual transactions, newest first. Dates are local YYYY-MM-DD, both inclusive. Amounts are signed NOK (negative is money out), unlike summarizeSpending. Transfers are included. To filter by category, call listCategories first and pass an id. Returns at most ${SEARCH_LIMIT_MAX} rows; check \`truncated\` and \`total\`, and use summarizeSpending for totals.`,
      inputSchema: {
        from: isoDate.optional(),
        to: isoDate.optional(),
        categoryId: z
          .string()
          .optional()
          .describe("Category id (see listCategories)."),
        accountId: z
          .string()
          .optional()
          .describe("Account id (see listAccounts)."),
        query: z
          .string()
          .optional()
          .describe("Matches merchant, note, or category name."),
        limit: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(`Defaults to 25, capped at ${SEARCH_LIMIT_MAX}.`),
      },
      annotations: READ_ONLY,
    },
    (input) => respond(() => queries.searchTransactions(input)),
  );

  server.registerTool(
    "getMonthInReview",
    {
      description:
        "Facts for one local calendar month: cashflow, comparison with the previous month, category movers, income sources, bills, and everyday spend. Amounts are NOK; spend is reported as positive numbers and excludes transfers.",
      inputSchema: {
        month: z.string().describe("Calendar month, YYYY-MM."),
      },
      annotations: READ_ONLY,
    },
    (input) => respond(() => queries.getMonthInReview(input)),
  );

  server.registerTool(
    "listCategories",
    {
      description:
        "All categories with id, name, and kind (EXPENSE, INCOME, TRANSFER). Names are in Norwegian (for example Dagligvarer is groceries), so call this first to map the user's words to category ids.",
      annotations: READ_ONLY,
    },
    () => respond(() => queries.listCategories()),
  );

  server.registerTool(
    "listAccounts",
    {
      description: "All accounts with id, name, institution, and isActive.",
      annotations: READ_ONLY,
    },
    () => respond(() => queries.listAccounts()),
  );

  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
