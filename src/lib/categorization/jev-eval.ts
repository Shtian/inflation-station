import type { PaymentType } from "@prisma/client";
import type { JevUnavailableReason } from "@/lib/jev/client";
import type {
  JevCategorizeRow,
  JevCategoryOption,
  JevOutcomeSummary,
  JevRowOutcome,
} from "./jev-categorize";

export type JevEvalCase = {
  normalizedMerchant: string;
  expectedCategoryId: string;
  row: JevCategorizeRow;
};

export type JevEvalResult = {
  outcome: JevRowOutcome;
  suggestion: { categoryId: string; confidence: number } | null;
  latencyMs: number;
};

export type LabeledTransaction = {
  normalizedMerchant: string;
  merchant: string | null;
  categoryId: string;
  bookingDate: Date;
  amountNok: number;
  currency: string;
  paymentType: PaymentType;
};

const UNAVAILABLE_REASONS: JevUnavailableReason[] = [
  "disabled",
  "key_missing",
  "timeout",
  "provider_error",
];

export function buildJevEvalCases(
  transactions: LabeledTransaction[],
  limit: number,
): JevEvalCase[] {
  const cases: JevEvalCase[] = [];
  const seen = new Set<string>();

  for (const transaction of transactions) {
    if (cases.length >= limit) break;
    if (seen.has(transaction.normalizedMerchant)) continue;
    seen.add(transaction.normalizedMerchant);

    cases.push({
      normalizedMerchant: transaction.normalizedMerchant,
      expectedCategoryId: transaction.categoryId,
      row: {
        rowNumber: cases.length + 1,
        bookingDate: transaction.bookingDate.toISOString().slice(0, 10),
        amountNok: transaction.amountNok,
        currency: transaction.currency,
        paymentType: transaction.paymentType,
        sender: "",
        recipient: "",
        name: transaction.merchant ?? transaction.normalizedMerchant,
        title: "",
      },
    });
  }

  return cases;
}

export function singleRowOutcome(summary: JevOutcomeSummary): JevRowOutcome {
  const counted = Object.entries(summary).filter(([, count]) => count > 0);
  const total = counted.reduce((sum, [, count]) => sum + count, 0);
  if (total !== 1) {
    throw new Error(`Expected exactly one row outcome, got ${total}`);
  }
  return counted[0][0] as JevRowOutcome;
}

function nearestRankPercentile(sorted: number[], percentile: number) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((percentile / 100) * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}

function alignColumns(rows: string[][]): string[] {
  const widths = rows[0]?.map((_, column) =>
    Math.max(...rows.map((row) => row[column].length)),
  );
  return rows.map((row) =>
    row
      .map((cell, column) =>
        column === row.length - 1 ? cell : cell.padEnd(widths[column]),
      )
      .join("  "),
  );
}

export function formatJevEvalReport(params: {
  cases: JevEvalCase[];
  results: JevEvalResult[];
  categories: JevCategoryOption[];
}): string {
  const { cases, results, categories } = params;
  if (cases.length !== results.length) {
    throw new Error(
      `Got ${results.length} results for ${cases.length} eval cases`,
    );
  }

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const nameOf = (id: string) => categoryName.get(id) ?? id;
  const countOf = (outcome: JevRowOutcome) =>
    results.filter((result) => result.outcome === outcome).length;

  const correct = results.filter(
    (result, index) =>
      result.suggestion?.categoryId === cases[index].expectedCategoryId,
  ).length;
  const suggested = countOf("ok");
  const unavailable = UNAVAILABLE_REASONS.reduce(
    (sum, reason) => sum + countOf(reason),
    0,
  );

  const latencies = results
    .map((result) => Math.round(result.latencyMs))
    .sort((a, b) => a - b);
  const p50 = nearestRankPercentile(latencies, 50);
  const max = latencies.at(-1) ?? null;

  const metric = (label: string, value: number | null, unit = "") =>
    `${label.padEnd(16)}${String(value ?? "-").padStart(5)}${unit}`;

  const metricLines = [
    metric("suggested", suggested),
    metric("  correct", correct),
    metric("  wrong", suggested - correct),
    metric("uncategorized", countOf("uncategorized")),
    metric("below_floor", countOf("below_floor")),
    metric("unavailable", unavailable),
    ...UNAVAILABLE_REASONS.map((reason) =>
      metric(`  ${reason}`, countOf(reason)),
    ),
    metric("latency p50", p50, " ms"),
    metric("latency max", max, " ms"),
  ];

  const missRows = results.flatMap((result, index) => {
    const evalCase = cases[index];
    if (result.suggestion?.categoryId === evalCase.expectedCategoryId) {
      return [];
    }
    return [
      [
        `  ${evalCase.row.name}`,
        `wanted ${nameOf(evalCase.expectedCategoryId)}`,
        result.suggestion
          ? `picked ${nameOf(result.suggestion.categoryId)}`
          : `picked (${result.outcome})`,
        `confidence ${result.suggestion ? result.suggestion.confidence.toFixed(2) : "-"}`,
      ],
    ];
  });

  return [
    `Jev categorization eval: ${cases.length} cases, ${categories.length} categories`,
    "",
    ...metricLines,
    "",
    `Wrong or missed (${missRows.length}):`,
    ...alignColumns(missRows),
  ].join("\n");
}
