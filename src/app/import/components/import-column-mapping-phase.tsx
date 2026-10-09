"use client";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNok } from "@/lib/format-nok";
import {
  type ColumnMappingDraft,
  type ColumnMappingField,
  type ColumnRef,
  completeColumnMapping,
} from "@/lib/import/csv/column-mapping";
import { parseMappedCsv } from "@/lib/import/csv/parse-mapped-csv";
import { cn } from "@/lib/utils";
import type {
  ColumnMappingDraftSources,
  ColumnMappingProposal,
} from "../use-import-workflow";

const SOURCE_LABELS: Record<
  ColumnMappingDraftSources[ColumnMappingField],
  string
> = {
  saved: "Saved",
  jev: "Suggested by Jev",
  heuristic: "Guessed",
  none: "Not found",
  manual: "Chosen by you",
};

type ImportColumnMappingPhaseProps = {
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

function sampleValues(proposal: ColumnMappingProposal, index: number): string {
  return proposal.sampleRows
    .map((row) => row.cells[index] ?? "")
    .filter((value) => value.trim().length > 0)
    .slice(0, 2)
    .join(" · ");
}

function formatList(items: string[]): string {
  return items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Every header as a radio or checkbox, each showing what that column holds. */
function ColumnChoices({
  legend,
  proposal,
  multiple = false,
  isSelected,
  onSelect,
}: {
  legend: string;
  proposal: ColumnMappingProposal;
  multiple?: boolean;
  isSelected: (index: number) => boolean;
  onSelect: (ref: ColumnRef, selected: boolean) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 font-medium text-xs">{legend}</legend>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {proposal.headers.map((header, index) => {
          const selected = isSelected(index);
          const ref = { index, header };
          const id = `${legend}-${index}`.replaceAll(" ", "-").toLowerCase();
          return (
            <label
              key={id}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-md border px-2.5 py-2 transition-colors hover:bg-muted/60",
                selected && "border-primary bg-primary/5",
              )}
            >
              {multiple ? (
                <Checkbox
                  id={id}
                  aria-label={header}
                  checked={selected}
                  onCheckedChange={(checked) => onSelect(ref, checked)}
                  className="mt-0.5"
                />
              ) : (
                <input
                  id={id}
                  type="radio"
                  name={legend}
                  aria-label={header}
                  checked={selected}
                  onChange={() => onSelect(ref, true)}
                  className="mt-0.5 accent-primary"
                />
              )}
              <span className="min-w-0">
                <span className="block font-medium text-sm">{header}</span>
                <span className="block truncate font-mono text-muted-foreground text-xs">
                  {sampleValues(proposal, index) || "Empty"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

type PreviewCells = {
  date: string | null;
  amount: string | null;
  description: string | null;
  paymentType: string;
};

const PREVIEW_COLUMNS = [
  { key: "date", label: "Date", className: "font-mono text-xs" },
  { key: "amount", label: "Amount", className: "text-right font-mono text-xs" },
  { key: "description", label: "Description", className: "" },
  { key: "paymentType", label: "Payment type", className: "" },
] as const;

function PreviewTable({
  rows,
  missing,
}: {
  rows: PreviewCells[];
  missing: Set<keyof PreviewCells>;
}) {
  return (
    <div className="rounded-lg border">
      <Table aria-label="Column mapping preview">
        <TableHeader>
          <TableRow>
            {PREVIEW_COLUMNS.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  column.key === "amount" && "text-right",
                  missing.has(column.key) && "text-amber-600",
                )}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground"
              >
                No sample row parses with this mapping.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              // Sample rows have no identity beyond their position.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <TableRow key={index}>
                {PREVIEW_COLUMNS.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.className,
                      column.key === "description" &&
                        "min-w-40 whitespace-normal",
                    )}
                  >
                    {row[column.key] ?? (
                      <span className="text-muted-foreground">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Missing</span>
                      </span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function ImportColumnMappingPhase({
  accountName,
  proposal,
  draft,
  sources,
  importError,
  importLoading,
  onChange,
  onConfirm,
  onBack,
}: ImportColumnMappingPhaseProps) {
  // The draft only holds a complete amount, so a half-chosen split and the
  // chosen kind live here until both columns are picked.
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

  const updateSplit = (next: typeof split) => {
    setSplit(next);
    onChange("amount", {
      ...draft,
      amount:
        next.inflow && next.outflow
          ? { kind: "split", inflow: next.inflow, outflow: next.outflow }
          : null,
    });
  };

  const chooseAmountKind = (kind: "signed" | "split") => {
    if (kind === amountKind) {
      return;
    }
    setAmountKind(kind);
    if (kind === "split") {
      updateSplit(split);
    } else {
      onChange("amount", { ...draft, amount: null });
    }
  };

  const mapping = completeColumnMapping(draft);
  const preview = mapping
    ? parseMappedCsv(
        { headers: proposal.headers, rows: proposal.sampleRows },
        mapping,
      )
    : null;
  const firstRow = preview?.rows[0];
  const firstSample = (ref: ColumnRef | null) =>
    ref ? (sampleValues(proposal, ref.index).split(" · ")[0] ?? "") : "";

  // Until the mapping is complete nothing parses, so the preview shows each
  // chosen column's raw value and leaves the missing ones empty.
  const rawCell = (cells: string[], ref: ColumnRef | null) =>
    ref ? (cells[ref.index] ?? "").trim() : "";
  const previewRows: PreviewCells[] = preview
    ? preview.rows.map((row) => ({
        date: row.bookingDate,
        amount: formatNok(row.amountNok),
        description: row.title,
        paymentType: row.paymentType,
      }))
    : proposal.sampleRows.map(({ cells }) => ({
        date: draft.date ? rawCell(cells, draft.date) : null,
        amount:
          draft.amount?.kind === "signed"
            ? rawCell(cells, draft.amount.column)
            : draft.amount?.kind === "split"
              ? rawCell(cells, draft.amount.inflow) ||
                `−${rawCell(cells, draft.amount.outflow)}`
              : null,
        description:
          draft.description.length > 0
            ? draft.description
                .map((ref) => rawCell(cells, ref))
                .filter(Boolean)
                .join(" ")
            : null,
        paymentType: rawCell(cells, draft.paymentType),
      }));

  const rows: {
    field: ColumnMappingField;
    label: string;
    columns: string;
    example: string;
    chosen: boolean;
    optional?: boolean;
  }[] = [
    {
      field: "date",
      label: "Date",
      columns: draft.date?.header ?? "",
      example: firstRow?.bookingDate ?? firstSample(draft.date),
      chosen: draft.date !== null,
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
      example: firstRow ? formatNok(firstRow.amountNok) : "",
      chosen: draft.amount !== null,
    },
    {
      field: "description",
      label: "Description",
      columns: draft.description.map((ref) => ref.header).join(" + "),
      example: previewRows[0]?.description ?? "",
      chosen: draft.description.length > 0,
    },
    {
      field: "paymentType",
      label: "Payment type",
      columns: draft.paymentType?.header ?? "",
      example: firstSample(draft.paymentType),
      chosen: draft.paymentType !== null,
      optional: true,
    },
  ];
  const missingLabels = rows
    .filter((row) => !row.optional && !row.chosen)
    .map((row) => row.label.toLowerCase());
  const missingSummary = formatList(missingLabels);
  const missingPreviewColumns = new Set<keyof PreviewCells>(
    rows
      .filter((row) => !row.optional && !row.chosen)
      .map((row) => row.field as keyof PreviewCells),
  );

  const [openField, setOpenField] = useState<ColumnMappingField | null>(
    rows.find((row) => !row.optional && !row.chosen)?.field ?? null,
  );

  const choices = (field: ColumnMappingField) => {
    switch (field) {
      case "date":
        return (
          <ColumnChoices
            legend="Date column"
            proposal={proposal}
            isSelected={(index) => draft.date?.index === index}
            onSelect={(ref) => onChange("date", { ...draft, date: ref })}
          />
        );
      case "amount":
        return (
          <div className="space-y-3">
            <fieldset className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <legend className="sr-only">Amount format</legend>
              {(
                [
                  ["signed", "One column, minus means money out"],
                  ["split", "Separate in and out columns"],
                ] as const
              ).map(([kind, label]) => (
                <label key={kind} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="Amount format"
                    checked={amountKind === kind}
                    onChange={() => chooseAmountKind(kind)}
                    className="accent-primary"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {amountKind === "signed" ? (
              <ColumnChoices
                legend="Amount column"
                proposal={proposal}
                isSelected={(index) =>
                  draft.amount?.kind === "signed" &&
                  draft.amount.column.index === index
                }
                onSelect={(ref) =>
                  onChange("amount", {
                    ...draft,
                    amount: { kind: "signed", column: ref },
                  })
                }
              />
            ) : (
              <>
                <ColumnChoices
                  legend="Money in column"
                  proposal={proposal}
                  isSelected={(index) => split.inflow?.index === index}
                  onSelect={(ref) => updateSplit({ ...split, inflow: ref })}
                />
                <ColumnChoices
                  legend="Money out column"
                  proposal={proposal}
                  isSelected={(index) => split.outflow?.index === index}
                  onSelect={(ref) => updateSplit({ ...split, outflow: ref })}
                />
              </>
            )}
          </div>
        );
      case "description":
        return (
          <ColumnChoices
            legend="Description columns"
            proposal={proposal}
            multiple
            isSelected={(index) =>
              draft.description.some((ref) => ref.index === index)
            }
            onSelect={(ref, selected) => {
              const next = selected
                ? [...draft.description, ref]
                : draft.description.filter((r) => r.index !== ref.index);
              onChange("description", {
                ...draft,
                description: next.sort((a, b) => a.index - b.index),
              });
            }}
          />
        );
      case "paymentType":
        return (
          <div className="space-y-2">
            <ColumnChoices
              legend="Payment type column"
              proposal={proposal}
              isSelected={(index) => draft.paymentType?.index === index}
              onSelect={(ref) =>
                onChange("paymentType", { ...draft, paymentType: ref })
              }
            />
            {draft.paymentType ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() =>
                  onChange("paymentType", { ...draft, paymentType: null })
                }
              >
                Don't use a payment type column
              </Button>
            ) : null}
          </div>
        );
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="space-y-1">
        <button
          type="button"
          onClick={onBack}
          disabled={importLoading}
          className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          Back
        </button>
        <h2 className="font-semibold text-foreground text-xl tracking-tight">
          Map Columns
        </h2>
      </div>

      <output className="flex items-center gap-2 font-medium text-sm">
        {mapping ? (
          <CircleCheck
            className="h-4 w-4 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
        ) : (
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-amber-600"
            aria-hidden="true"
          />
        )}
        <span>
          {mapping
            ? `Ready to review · checked against ${proposal.sampleRows.length} sample rows`
            : `${missingSummary.charAt(0).toUpperCase()}${missingSummary.slice(1)} ${missingLabels.length === 1 ? "needs" : "need"} a column`}
        </span>
      </output>

      <ul aria-label="Column mapping" className="divide-y rounded-xl border">
        {rows.map((row) => {
          const open = openField === row.field;
          return (
            <li key={row.field}>
              <Collapsible
                open={open}
                onOpenChange={(next) => setOpenField(next ? row.field : null)}
              >
                <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                  {row.chosen ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : row.optional ? (
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-dashed"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertTriangle
                      className="h-4 w-4 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                  )}
                  <span className="w-24 shrink-0 font-medium text-sm sm:w-28">
                    {row.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-mono text-xs sm:truncate">
                      {row.columns ||
                        (row.optional ? "Not used" : "Choose a column")}
                    </span>
                    {row.example ? (
                      <span className="block break-words text-muted-foreground text-xs sm:truncate">
                        e.g. {row.example}
                      </span>
                    ) : null}
                    <span className="block text-muted-foreground text-xs sm:hidden">
                      {SOURCE_LABELS[sources[row.field]]}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "hidden shrink-0 text-xs sm:inline",
                      sources[row.field] === "none" && !row.optional
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {SOURCE_LABELS[sources[row.field]]}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t bg-muted/20 px-4 py-3">
                  {choices(row.field)}
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        })}
      </ul>

      <section
        aria-labelledby="column-mapping-preview-heading"
        className="space-y-2"
      >
        <h3
          id="column-mapping-preview-heading"
          className="font-medium text-foreground text-sm"
        >
          {mapping
            ? `How the first ${proposal.sampleRows.length} rows will import`
            : "Raw values so far"}
        </h3>
        <PreviewTable rows={previewRows} missing={missingPreviewColumns} />
      </section>

      {preview && preview.summary.ignoredReserved > 0 ? (
        <p className="text-muted-foreground text-xs">
          {preview.summary.ignoredReserved} reserved row
          {preview.summary.ignoredReserved === 1 ? "" : "s"} will be skipped.
        </p>
      ) : null}
      {preview && preview.errors.length > 0 ? (
        <ul
          aria-label="Preview parse errors"
          className="space-y-1 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {preview.errors.map((error) => (
            <li key={`${error.rowNumber}-${error.code}`}>{error.message}</li>
          ))}
        </ul>
      ) : null}

      {importError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {importError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs sm:max-w-sm">
          {mapping ? (
            <>
              Saved for{" "}
              <span className="font-medium text-foreground">{accountName}</span>{" "}
              and reused for files with the same headers. Nothing is imported
              until you finish the review.
            </>
          ) : (
            <span id="column-mapping-missing">
              Pick a column for {missingSummary} to continue.
            </span>
          )}
        </p>
        <Button
          onClick={onConfirm}
          disabled={importLoading || mapping === null}
          aria-describedby={mapping ? undefined : "column-mapping-missing"}
          className="w-full gap-2 sm:w-auto"
        >
          {importLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          Confirm mapping
        </Button>
      </div>
    </div>
  );
}
