import type { Fetch } from "@typesafe-ai/sdk";
import { runJevChoice } from "@/lib/jev/client";
import { classifyJevConfidence } from "@/lib/jev/confidence-tier";
import {
  type ColumnMapping,
  type ColumnMappingDraft,
  type ColumnMappingField,
  type ColumnMappingGuess,
  type ColumnMappingSources,
  type ColumnRef,
  columnMappingFitsHeaders,
  parseColumnMapping,
  toColumnMappingDraft,
  toCsvHeaderSignature,
} from "./column-mapping";
import { guessColumnMappingHeuristically } from "./guess-heuristic";

export const COLUMN_MAPPING_SAMPLE_ROWS = 5;

const NO_COLUMN_CHOICE = "none";

const JEV_FIELD_INSTRUCTIONS: Record<ColumnMappingField, string> = {
  date: "pick the column that holds each bank transaction's booking date",
  amount:
    "pick the column that holds each bank transaction's signed amount, negative for money going out",
  description:
    "pick the column that best names the merchant or counterparty of each bank transaction",
  paymentType:
    "pick the column that holds each bank transaction's payment method, such as card or transfer, or none if no column does",
};

export type SavedColumnMapping = {
  csvColumnMapping: unknown;
  csvHeaderSignature: string | null;
};

export type JevOptions = {
  apiKey?: string;
  fetchImpl?: Fetch;
};

/** A saved mapping applies only to a file with the exact headers it was confirmed on. */
export function resolveSavedColumnMapping(
  saved: SavedColumnMapping | null,
  headers: readonly string[],
): ColumnMapping | null {
  if (
    !saved?.csvHeaderSignature ||
    saved.csvHeaderSignature !== toCsvHeaderSignature(headers)
  ) {
    return null;
  }

  const mapping = parseColumnMapping(saved.csvColumnMapping);
  return mapping && columnMappingFitsHeaders(mapping, headers) ? mapping : null;
}

export function savedColumnMappingGuess(
  mapping: ColumnMapping,
): ColumnMappingGuess {
  return {
    mapping: toColumnMappingDraft(mapping),
    sources: {
      date: "saved",
      amount: "saved",
      description: "saved",
      paymentType: "saved",
    },
  };
}

function columnChoice(index: number): string {
  return `column_${index}`;
}

function buildAlternatives(
  headers: readonly string[],
  sampleRows: readonly (readonly string[])[],
): Record<string, string> {
  const alternatives: Record<string, string> = {
    [NO_COLUMN_CHOICE]: "no column holds this",
  };

  headers.forEach((header, index) => {
    const samples = sampleRows
      .map((cells) => cells[index] ?? "")
      .filter((value) => value.trim().length > 0)
      .join(", ");
    alternatives[columnChoice(index)] = samples
      ? `${header} (for example: ${samples})`
      : header;
  });

  return alternatives;
}

async function askJevForColumn(
  field: ColumnMappingField,
  headers: readonly string[],
  sampleRows: readonly (readonly string[])[],
  jev: JevOptions,
): Promise<ColumnRef | null> {
  const result = await runJevChoice({
    apiKey: jev.apiKey,
    fetchImpl: jev.fetchImpl,
    instructions: JEV_FIELD_INSTRUCTIONS[field],
    alternatives: buildAlternatives(headers, sampleRows),
    state: {
      headers: [...headers],
      rows: sampleRows.map((cells) => [...cells]),
    },
  });

  if (
    result.status !== "ok" ||
    result.choice === NO_COLUMN_CHOICE ||
    classifyJevConfidence(result.confidence) !== "high"
  ) {
    return null;
  }

  const index = Number(result.choice.slice("column_".length));
  return Number.isInteger(index) && index >= 0 && index < headers.length
    ? { index, header: headers[index] }
    : null;
}

function sourceFor(present: boolean): "heuristic" | "none" {
  return present ? "heuristic" : "none";
}

/**
 * Proposes a mapping for a file that has no saved mapping. The heuristic
 * guess is always computed; Jev replaces a field only when it answers with
 * high confidence, and Jev being unavailable leaves the heuristic guess as is.
 */
export async function guessColumnMapping(params: {
  headers: readonly string[];
  sampleRows: readonly (readonly string[])[];
  jev?: JevOptions;
}): Promise<ColumnMappingGuess> {
  const { headers } = params;
  const sampleRows = params.sampleRows.slice(0, COLUMN_MAPPING_SAMPLE_ROWS);
  const heuristic = guessColumnMappingHeuristically(headers, sampleRows);
  const jev = params.jev ?? {};

  const [date, amount, description, paymentType] = await Promise.all(
    (["date", "amount", "description", "paymentType"] as const).map((field) =>
      askJevForColumn(field, headers, sampleRows, jev),
    ),
  );

  const mapping: ColumnMappingDraft = { ...heuristic };
  const sources: ColumnMappingSources = {
    date: sourceFor(heuristic.date !== null),
    amount: sourceFor(heuristic.amount !== null),
    description: sourceFor(heuristic.description.length > 0),
    paymentType: sourceFor(heuristic.paymentType !== null),
  };

  if (date) {
    mapping.date = date;
    sources.date = "jev";
  }

  // Jev answers with one column, so it cannot express a split amount; a
  // split the headers already found stays.
  if (amount && heuristic.amount?.kind !== "split") {
    mapping.amount = { kind: "signed", column: amount };
    sources.amount = "jev";
  }

  // A multi-column description the headers found is kept when Jev's single
  // pick is already part of it.
  if (
    description &&
    !heuristic.description.some((ref) => ref.index === description.index)
  ) {
    mapping.description = [description];
    sources.description = "jev";
  }

  if (paymentType) {
    mapping.paymentType = paymentType;
    sources.paymentType = "jev";
  }

  return { mapping, sources };
}
