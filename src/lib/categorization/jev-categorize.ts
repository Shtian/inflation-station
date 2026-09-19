import type { PaymentType } from "@prisma/client";
import type { Fetch } from "@typesafe-ai/sdk";
import { runJevChoice } from "@/lib/jev/client";

const UNCATEGORIZED_CHOICE = "uncategorized";
const INSTRUCTIONS =
  "pick the category that best fits this bank transaction, or Uncategorized if none clearly fits";
const DEFAULT_CONCURRENCY = 12;

export type JevCategorizeRow = {
  rowNumber: number;
  bookingDate: string;
  amountNok: number;
  currency: string;
  paymentType: PaymentType;
  sender: string;
  recipient: string;
  name: string;
  title: string;
};

export type JevCategoryOption = {
  id: string;
  name: string;
  classifierHint: string | null;
};

export type JevCategorySuggestion = {
  rowNumber: number;
  categoryId: string;
  source: "JEV";
  confidence: number;
};

function buildAlternatives(
  categories: JevCategoryOption[],
): Record<string, string | null> {
  const alternatives: Record<string, string | null> = {
    [UNCATEGORIZED_CHOICE]:
      "none of the above categories fit this transaction.",
  };

  for (const category of categories) {
    alternatives[category.id] = category.classifierHint
      ? `${category.name}: ${category.classifierHint}`
      : category.name;
  }

  return alternatives;
}

function toJevState(row: JevCategorizeRow) {
  return {
    bookingDate: row.bookingDate,
    amountNok: row.amountNok,
    currency: row.currency,
    paymentType: row.paymentType,
    sender: row.sender,
    recipient: row.recipient,
    name: row.name,
    title: row.title,
  };
}

async function categorizeRow(
  row: JevCategorizeRow,
  alternatives: Record<string, string | null>,
  apiKey: string | undefined,
  fetchImpl: Fetch | undefined,
): Promise<JevCategorySuggestion | null> {
  const result = await runJevChoice({
    apiKey,
    fetchImpl,
    instructions: INSTRUCTIONS,
    alternatives,
    state: toJevState(row),
  });

  if (result.status !== "ok" || result.choice === UNCATEGORIZED_CHOICE) {
    return null;
  }

  return {
    rowNumber: row.rowNumber,
    categoryId: result.choice,
    source: "JEV",
    confidence: result.confidence,
  };
}

export async function categorizeRowsWithJev(params: {
  rows: JevCategorizeRow[];
  categories: JevCategoryOption[];
  concurrency?: number;
  apiKey?: string;
  fetchImpl?: Fetch;
}): Promise<JevCategorySuggestion[]> {
  const { rows, categories, apiKey, fetchImpl } = params;

  if (rows.length === 0 || categories.length === 0) {
    return [];
  }

  const alternatives = buildAlternatives(categories);
  const concurrency = Math.max(
    1,
    Math.min(params.concurrency ?? DEFAULT_CONCURRENCY, rows.length),
  );

  const suggestions: JevCategorySuggestion[] = [];
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= rows.length) {
        return;
      }

      const suggestion = await categorizeRow(
        rows[index],
        alternatives,
        apiKey,
        fetchImpl,
      );
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return suggestions;
}
