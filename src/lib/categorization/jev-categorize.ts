import type { PaymentType } from "@prisma/client";
import type { Fetch } from "@typesafe-ai/sdk";
import { type JevUnavailableReason, runJevChoice } from "@/lib/jev/client";
import { classifyJevConfidence } from "@/lib/jev/confidence-tier";
import { formatJevCategoryLine } from "./hint-text";

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

export type JevRowOutcome =
  | "ok"
  | "uncategorized"
  | "below_floor"
  | JevUnavailableReason;

export type JevOutcomeSummary = Record<JevRowOutcome, number>;

export type JevCategorization = {
  suggestions: JevCategorySuggestion[];
  outcomes: JevOutcomeSummary;
};

type JevRowResult =
  | { outcome: "ok"; suggestion: JevCategorySuggestion }
  | { outcome: Exclude<JevRowOutcome, "ok"> };

export function emptyJevOutcomeSummary(): JevOutcomeSummary {
  return {
    ok: 0,
    uncategorized: 0,
    below_floor: 0,
    disabled: 0,
    key_missing: 0,
    timeout: 0,
    provider_error: 0,
  };
}

function buildAlternatives(
  categories: JevCategoryOption[],
): Record<string, string | null> {
  const alternatives: Record<string, string | null> = {
    [UNCATEGORIZED_CHOICE]:
      "none of the above categories fit this transaction.",
  };

  for (const category of categories) {
    alternatives[category.id] = formatJevCategoryLine(
      category.name,
      category.classifierHint,
    );
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
): Promise<JevRowResult> {
  const result = await runJevChoice({
    apiKey,
    fetchImpl,
    instructions: INSTRUCTIONS,
    alternatives,
    state: toJevState(row),
  });

  if (result.status !== "ok") {
    return { outcome: result.reason };
  }
  if (result.choice === UNCATEGORIZED_CHOICE) {
    return { outcome: "uncategorized" };
  }
  if (classifyJevConfidence(result.confidence) === null) {
    return { outcome: "below_floor" };
  }

  return {
    outcome: "ok",
    suggestion: {
      rowNumber: row.rowNumber,
      categoryId: result.choice,
      source: "JEV",
      confidence: result.confidence,
    },
  };
}

export async function categorizeRowsWithJev(params: {
  rows: JevCategorizeRow[];
  categories: JevCategoryOption[];
  concurrency?: number;
  apiKey?: string;
  fetchImpl?: Fetch;
}): Promise<JevCategorization> {
  const { rows, categories, apiKey, fetchImpl } = params;
  const suggestions: JevCategorySuggestion[] = [];
  const outcomes = emptyJevOutcomeSummary();

  if (rows.length === 0 || categories.length === 0) {
    return { suggestions, outcomes };
  }

  const alternatives = buildAlternatives(categories);
  const concurrency = Math.max(
    1,
    Math.min(params.concurrency ?? DEFAULT_CONCURRENCY, rows.length),
  );

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= rows.length) {
        return;
      }

      const result = await categorizeRow(
        rows[index],
        alternatives,
        apiKey,
        fetchImpl,
      );
      outcomes[result.outcome] += 1;
      if (result.outcome === "ok") {
        suggestions.push(result.suggestion);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return { suggestions, outcomes };
}
