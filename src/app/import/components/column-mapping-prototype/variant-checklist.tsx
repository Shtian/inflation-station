"use client";

// PROTOTYPE — throwaway. Variant D: confirm first. Assumes the guess is
// usually right (saved / Jev), so the screen is a short checklist with one
// big Confirm; only fields that need attention open by default.

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleCheck,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatNok } from "@/lib/format-nok";
import {
  type ColumnMappingField,
  completeColumnMapping,
} from "@/lib/import/csv/column-mapping";
import { cn } from "@/lib/utils";
import {
  columnSamples,
  type MappingVariantProps,
  previewFor,
  SOURCE_LABELS,
  useMappingEditor,
} from "./shared";

type FieldRow = {
  field: ColumnMappingField;
  label: string;
  columns: string;
  sample: string;
  ok: boolean;
  optional?: boolean;
};

export function VariantChecklist(props: MappingVariantProps) {
  const { proposal, draft, sources } = props;
  const editor = useMappingEditor(props);
  const preview = previewFor(proposal, draft);
  const first = preview?.rows[0];
  const sampleOf = (index: number | undefined) =>
    index === undefined ? "" : (columnSamples(proposal, index, 1)[0] ?? "");

  const rows: FieldRow[] = [
    {
      field: "date",
      label: "Date",
      columns: draft.date?.header ?? "",
      sample: first?.bookingDate ?? sampleOf(draft.date?.index),
      ok: draft.date !== null,
    },
    {
      field: "amount",
      label: "Amount",
      columns:
        draft.amount?.kind === "signed"
          ? draft.amount.column.header
          : draft.amount?.kind === "split"
            ? `${draft.amount.inflow.header} (in) / ${draft.amount.outflow.header} (out)`
            : "",
      sample: first ? formatNok(first.amountNok) : "",
      ok: draft.amount !== null,
    },
    {
      field: "description",
      label: "Description",
      columns: draft.description.map((ref) => ref.header).join(" + "),
      sample: first?.title ?? "",
      ok: draft.description.length > 0,
    },
    {
      field: "paymentType",
      label: "Payment type",
      columns: draft.paymentType?.header ?? "",
      sample: first?.paymentType ?? sampleOf(draft.paymentType?.index),
      ok: true,
      optional: true,
    },
  ];

  const needsAttention = rows.filter(
    (row) => !row.ok || sources[row.field] === "none",
  );
  const [open, setOpen] = useState<ColumnMappingField | null>(
    rows.find((row) => !row.ok)?.field ?? null,
  );
  const ready = completeColumnMapping(draft) !== null;

  const picker = (field: ColumnMappingField) => {
    const radio = (
      selected: (index: number) => boolean,
      onPick: (index: number) => void,
      name: string,
      type: "radio" | "checkbox" = "radio",
    ) => (
      <div className="grid gap-1 sm:grid-cols-2">
        {proposal.headers.map((header, index) => (
          <label
            key={header + String(index)}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 hover:bg-muted/60",
              selected(index) && "border-primary bg-primary/5",
            )}
          >
            <input
              type={type}
              name={name}
              checked={selected(index)}
              onChange={() => onPick(index)}
              className="mt-1 accent-primary"
            />
            <span className="min-w-0">
              <span className="block font-medium text-sm">{header}</span>
              <span className="block truncate font-mono text-muted-foreground text-xs">
                {columnSamples(proposal, index).join(" · ") || "empty"}
              </span>
            </span>
          </label>
        ))}
      </div>
    );

    switch (field) {
      case "date":
        return radio(
          (index) => draft.date?.index === index,
          (index) => editor.assign(index, "date"),
          "date",
        );
      case "paymentType":
        return (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => editor.clear("paymentType")}
              className="text-muted-foreground text-xs underline"
            >
              Don't use a payment type column
            </button>
            {radio(
              (index) => draft.paymentType?.index === index,
              (index) => editor.assign(index, "paymentType"),
              "paymentType",
            )}
          </div>
        );
      case "description":
        return radio(
          (index) => editor.roleOf(index) === "description",
          (index) => editor.toggleDescription(index),
          "description",
          "checkbox",
        );
      case "amount":
        return (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm">
              {(["signed", "split"] as const).map((kind) => (
                <label key={kind} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="amount-kind"
                    checked={editor.amountKind === kind}
                    onChange={() => editor.chooseAmountKind(kind)}
                    className="accent-primary"
                  />
                  {kind === "signed"
                    ? "One column, minus means spent"
                    : "Separate in and out columns"}
                </label>
              ))}
            </div>
            {editor.amountKind === "signed"
              ? radio(
                  (index) => editor.columnFor("amount")?.index === index,
                  (index) => editor.assign(index, "amount"),
                  "amount",
                )
              : (["inflow", "outflow"] as const).map((role) => (
                  <div key={role} className="space-y-1">
                    <p className="font-medium text-xs">
                      {role === "inflow" ? "Money in" : "Money out"}
                    </p>
                    {radio(
                      (index) => editor.split[role]?.index === index,
                      (index) => editor.assign(index, role),
                      role,
                    )}
                  </div>
                ))}
          </div>
        );
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <button
        type="button"
        onClick={props.onBack}
        className="flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </button>

      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border p-5",
          ready
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-amber-500/40 bg-amber-500/5",
        )}
      >
        {ready ? (
          <CircleCheck className="h-8 w-8 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-8 w-8 shrink-0 text-amber-600" />
        )}
        <div className="flex-1">
          <h2 className="font-semibold text-lg tracking-tight">
            {ready
              ? "We understood this file"
              : `${rows.filter((row) => !row.ok).length} column${rows.filter((row) => !row.ok).length === 1 ? "" : "s"} still needed`}
          </h2>
          <p className="text-muted-foreground text-sm">
            {proposal.headers.length} columns, {proposal.sampleRows.length}{" "}
            sample rows checked. Saved for {props.accountName}.
            {needsAttention.length > 0 && ready
              ? " Payment type wasn't found — that's fine."
              : ""}
          </p>
        </div>
        <Button
          size="lg"
          onClick={props.onConfirm}
          disabled={props.importLoading || !ready}
          className="gap-2"
        >
          {props.importLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Import
        </Button>
      </div>

      <ul className="divide-y rounded-xl border">
        {rows.map((row) => (
          <li key={row.field}>
            <Collapsible
              open={open === row.field}
              onOpenChange={(next) => setOpen(next ? row.field : null)}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                {row.ok && row.columns ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : row.optional ? (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-dashed" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                )}
                <span className="w-28 shrink-0 font-medium text-sm">
                  {row.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs">
                    {row.columns ||
                      (row.optional ? "Not used" : "Choose a column")}
                  </span>
                  {row.sample ? (
                    <span className="block truncate text-muted-foreground text-xs">
                      e.g. {row.sample}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {SOURCE_LABELS[sources[row.field]]}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    open === row.field && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t bg-muted/20 px-4 py-3">
                {picker(row.field)}
              </CollapsibleContent>
            </Collapsible>
          </li>
        ))}
      </ul>

      {preview && preview.errors.length > 0 ? (
        <p className="text-destructive text-sm">
          {preview.errors.length} sample row
          {preview.errors.length === 1 ? "" : "s"} won't import:{" "}
          {preview.errors[0].message}
        </p>
      ) : null}

      {props.importError ? (
        <p role="alert" className="text-destructive text-sm">
          {props.importError}
        </p>
      ) : null}
    </div>
  );
}
