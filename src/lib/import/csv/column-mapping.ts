import { z } from "zod";
import { normalizeCsvHeader } from "./csv-statement";

export type ColumnRef = { index: number; header: string };

export type AmountMapping =
  | { kind: "signed"; column: ColumnRef }
  | { kind: "split"; inflow: ColumnRef; outflow: ColumnRef };

export type ColumnMapping = {
  date: ColumnRef;
  amount: AmountMapping;
  /** Joined in order with " " into the row's description. */
  description: ColumnRef[];
  paymentType?: ColumnRef;
};

export const COLUMN_MAPPING_FIELDS = [
  "date",
  "amount",
  "description",
  "paymentType",
] as const;

export type ColumnMappingField = (typeof COLUMN_MAPPING_FIELDS)[number];

export type ColumnMappingSource = "saved" | "jev" | "heuristic" | "none";

export type ColumnMappingSources = Record<
  ColumnMappingField,
  ColumnMappingSource
>;

/** A mapping that may still be missing fields; what the guessers produce. */
export type ColumnMappingDraft = {
  date: ColumnRef | null;
  amount: AmountMapping | null;
  description: ColumnRef[];
  paymentType: ColumnRef | null;
};

export type ColumnMappingGuess = {
  mapping: ColumnMappingDraft;
  sources: ColumnMappingSources;
};

const columnRefSchema = z.object({
  index: z.number().int().nonnegative(),
  header: z.string(),
});

const columnMappingSchema = z.object({
  date: columnRefSchema,
  amount: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("signed"), column: columnRefSchema }),
    z.object({
      kind: z.literal("split"),
      inflow: columnRefSchema,
      outflow: columnRefSchema,
    }),
  ]),
  description: z.array(columnRefSchema).min(1),
  paymentType: columnRefSchema.optional(),
});

/** Parses untrusted JSON (request body, database column) into a mapping. */
export function parseColumnMapping(value: unknown): ColumnMapping | null {
  const parsed = columnMappingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function toCsvHeaderSignature(headers: readonly string[]): string {
  return headers.map((header) => normalizeCsvHeader(header)).join("|");
}

export function columnMappingRefs(mapping: ColumnMapping): ColumnRef[] {
  const amountRefs =
    mapping.amount.kind === "signed"
      ? [mapping.amount.column]
      : [mapping.amount.inflow, mapping.amount.outflow];

  return [
    mapping.date,
    ...amountRefs,
    ...mapping.description,
    ...(mapping.paymentType ? [mapping.paymentType] : []),
  ];
}

/**
 * A mapping only fits a file when every column it names sits at the same
 * index under the same header; a reordered export must be remapped.
 */
export function columnMappingFitsHeaders(
  mapping: ColumnMapping,
  headers: readonly string[],
): boolean {
  return columnMappingRefs(mapping).every(
    (ref) =>
      ref.index < headers.length &&
      normalizeCsvHeader(headers[ref.index]) === normalizeCsvHeader(ref.header),
  );
}

export function completeColumnMapping(
  draft: ColumnMappingDraft,
): ColumnMapping | null {
  if (!draft.date || !draft.amount || draft.description.length === 0) {
    return null;
  }

  return {
    date: draft.date,
    amount: draft.amount,
    description: draft.description,
    ...(draft.paymentType ? { paymentType: draft.paymentType } : {}),
  };
}

export function toColumnMappingDraft(
  mapping: ColumnMapping,
): ColumnMappingDraft {
  return {
    date: mapping.date,
    amount: mapping.amount,
    description: mapping.description,
    paymentType: mapping.paymentType ?? null,
  };
}
