// PROTOTYPE — throwaway. Lives on branch prototype/column-mapping-layouts only.
// State helpers shared by the column-mapping layout variants so each variant
// is free to own its layout while editing the same draft the same way.

import { useState } from "react";
import {
  type ColumnMappingDraft,
  type ColumnMappingField,
  type ColumnRef,
  completeColumnMapping,
} from "@/lib/import/csv/column-mapping";
import { parseMappedCsv } from "@/lib/import/csv/parse-mapped-csv";
import type {
  ColumnMappingDraftSources,
  ColumnMappingProposal,
} from "../../use-import-workflow";

export type MappingVariantProps = {
  accountName: string;
  proposal: ColumnMappingProposal;
  draft: ColumnMappingDraft;
  sources: ColumnMappingDraftSources;
  importError: string | null;
  importLoading: boolean;
  onChange: (field: ColumnMappingField, next: ColumnMappingDraft) => void;
  onConfirm: () => void;
  onBack: () => void;
};

export type Role =
  | "date"
  | "amount"
  | "inflow"
  | "outflow"
  | "description"
  | "paymentType"
  | "ignore";

export const ROLE_LABELS: Record<Role, string> = {
  date: "Date",
  amount: "Amount",
  inflow: "Money in",
  outflow: "Money out",
  description: "Description",
  paymentType: "Payment type",
  ignore: "Ignore",
};

export const SOURCE_LABELS: Record<
  ColumnMappingDraftSources[ColumnMappingField],
  string
> = {
  saved: "Saved",
  jev: "Jev",
  heuristic: "Guessed",
  none: "Not found",
  manual: "You",
};

const ROLE_FIELD: Record<Exclude<Role, "ignore">, ColumnMappingField> = {
  date: "date",
  amount: "amount",
  inflow: "amount",
  outflow: "amount",
  description: "description",
  paymentType: "paymentType",
};

export function columnSamples(
  proposal: ColumnMappingProposal,
  index: number,
  limit = 2,
): string[] {
  return proposal.sampleRows
    .map((row) => (row.cells[index] ?? "").trim())
    .filter((value) => value.length > 0)
    .slice(0, limit);
}

export function previewFor(
  proposal: ColumnMappingProposal,
  draft: ColumnMappingDraft,
) {
  const mapping = completeColumnMapping(draft);
  return mapping
    ? parseMappedCsv(
        { headers: proposal.headers, rows: proposal.sampleRows },
        mapping,
      )
    : null;
}

export function useMappingEditor({
  proposal,
  draft,
  onChange,
}: Pick<MappingVariantProps, "proposal" | "draft" | "onChange">) {
  const [amountKind, setAmountKind] = useState<"signed" | "split">(
    draft.amount?.kind ?? "signed",
  );
  const [split, setSplit] = useState<{
    inflow: ColumnRef | null;
    outflow: ColumnRef | null;
  }>(
    draft.amount?.kind === "split"
      ? { inflow: draft.amount.inflow, outflow: draft.amount.outflow }
      : { inflow: null, outflow: null },
  );

  const roleOf = (index: number): Role => {
    if (draft.date?.index === index) return "date";
    if (
      amountKind === "signed" &&
      draft.amount?.kind === "signed" &&
      draft.amount.column.index === index
    )
      return "amount";
    if (amountKind === "split" && split.inflow?.index === index)
      return "inflow";
    if (amountKind === "split" && split.outflow?.index === index)
      return "outflow";
    if (draft.paymentType?.index === index) return "paymentType";
    if (draft.description.some((ref) => ref.index === index))
      return "description";
    return "ignore";
  };

  const columnFor = (role: Exclude<Role, "ignore" | "description">) => {
    switch (role) {
      case "date":
        return draft.date;
      case "paymentType":
        return draft.paymentType;
      case "amount":
        return draft.amount?.kind === "signed" ? draft.amount.column : null;
      case "inflow":
        return amountKind === "split" ? split.inflow : null;
      case "outflow":
        return amountKind === "split" ? split.outflow : null;
    }
  };

  /** Give column `index` the role, taking it off whatever it held before. */
  const assign = (index: number, role: Role) => {
    const previous = roleOf(index);
    const ref = { index, header: proposal.headers[index] };
    const next: ColumnMappingDraft = {
      ...draft,
      description: draft.description.filter((r) => r.index !== index),
      date: draft.date?.index === index ? null : draft.date,
      paymentType:
        draft.paymentType?.index === index ? null : draft.paymentType,
      amount:
        draft.amount?.kind === "signed" && draft.amount.column.index === index
          ? null
          : draft.amount,
    };
    let nextSplit = {
      inflow: split.inflow?.index === index ? null : split.inflow,
      outflow: split.outflow?.index === index ? null : split.outflow,
    };
    let kind = amountKind;

    switch (role) {
      case "date":
        next.date = ref;
        break;
      case "paymentType":
        next.paymentType = ref;
        break;
      case "description":
        next.description = [...next.description, ref].sort(
          (a, b) => a.index - b.index,
        );
        break;
      case "amount":
        kind = "signed";
        next.amount = { kind: "signed", column: ref };
        break;
      case "inflow":
        kind = "split";
        nextSplit = { ...nextSplit, inflow: ref };
        break;
      case "outflow":
        kind = "split";
        nextSplit = { ...nextSplit, outflow: ref };
        break;
    }
    if (kind === "split") {
      next.amount =
        nextSplit.inflow && nextSplit.outflow
          ? {
              kind: "split",
              inflow: nextSplit.inflow,
              outflow: nextSplit.outflow,
            }
          : null;
    }

    setSplit(nextSplit);
    setAmountKind(kind);
    const field =
      role !== "ignore"
        ? ROLE_FIELD[role]
        : previous !== "ignore"
          ? ROLE_FIELD[previous]
          : "description";
    onChange(field, next);
  };

  const clear = (role: Exclude<Role, "ignore" | "description">) => {
    const current = columnFor(role);
    if (current) assign(current.index, "ignore");
  };

  const toggleDescription = (index: number) =>
    assign(index, roleOf(index) === "description" ? "ignore" : "description");

  const chooseAmountKind = (kind: "signed" | "split") => {
    if (kind === amountKind) return;
    setAmountKind(kind);
    onChange("amount", {
      ...draft,
      amount:
        kind === "split" && split.inflow && split.outflow
          ? { kind: "split", inflow: split.inflow, outflow: split.outflow }
          : null,
    });
  };

  return {
    amountKind,
    split,
    roleOf,
    columnFor,
    assign,
    clear,
    toggleDescription,
    chooseAmountKind,
  };
}
