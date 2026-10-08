"use client";

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type {
  ColumnMappingDraftSources,
  ColumnMappingProposal,
} from "../use-import-workflow";

const NO_COLUMN = "none";

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
    .join(", ");
}

function SourceBadge({
  source,
}: {
  source: ColumnMappingDraftSources[ColumnMappingField];
}) {
  return (
    <Badge
      variant={source === "none" ? "destructive" : "outline"}
      className="text-xs"
    >
      {SOURCE_LABELS[source]}
    </Badge>
  );
}

function ColumnSelect({
  id,
  label,
  proposal,
  value,
  allowNone = false,
  onChange,
}: {
  id: string;
  label: string;
  proposal: ColumnMappingProposal;
  value: ColumnRef | null;
  allowNone?: boolean;
  onChange: (ref: ColumnRef | null) => void;
}) {
  const items = [
    ...(allowNone ? [{ value: NO_COLUMN, label: "None" }] : []),
    ...proposal.headers.map((header, index) => ({
      value: String(index),
      label: header,
    })),
  ];

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FieldContent>
        <Select
          items={items}
          value={value ? String(value.index) : allowNone ? NO_COLUMN : null}
          onValueChange={(next) => {
            if (next === null || next === NO_COLUMN) {
              onChange(null);
              return;
            }
            const index = Number(next);
            onChange({ index, header: proposal.headers[index] });
          }}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Choose a column" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => {
              const samples =
                item.value === NO_COLUMN
                  ? ""
                  : sampleValues(proposal, Number(item.value));
              return (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                  {samples ? (
                    <span className="text-muted-foreground text-xs">
                      {samples}
                    </span>
                  ) : null}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
  );
}

function MappingPreview({
  proposal,
  draft,
}: {
  proposal: ColumnMappingProposal;
  draft: ColumnMappingDraft;
}) {
  const mapping = completeColumnMapping(draft);

  if (!mapping) {
    return (
      <p className="text-muted-foreground text-sm">
        Choose a date column, an amount and at least one description column to
        see a preview.
      </p>
    );
  }

  const preview = parseMappedCsv(
    { headers: proposal.headers, rows: proposal.sampleRows },
    mapping,
  );

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border">
        <Table aria-label="Column mapping preview">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Payment type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No sample row parses with this mapping.
                </TableCell>
              </TableRow>
            ) : (
              preview.rows.map((row, index) => (
                // Sample rows have no identity beyond their position.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                <TableRow key={index}>
                  <TableCell className="font-mono text-xs">
                    {row.bookingDate}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatNok(row.amountNok)}
                  </TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.paymentType}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {preview.summary.ignoredReserved > 0 ? (
        <p className="text-muted-foreground text-xs">
          {preview.summary.ignoredReserved} reserved row
          {preview.summary.ignoredReserved === 1 ? "" : "s"} will be skipped.
        </p>
      ) : null}
      {preview.errors.length > 0 ? (
        <ul
          aria-label="Preview parse errors"
          className="space-y-1 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {preview.errors.map((error) => (
            <li key={`${error.rowNumber}-${error.code}`}>{error.message}</li>
          ))}
        </ul>
      ) : null}
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
  const selectedDescription = new Set(
    draft.description.map((ref) => ref.index),
  );
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
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
        <p className="text-muted-foreground text-sm">
          Pick which columns hold each value. The mapping is saved for{" "}
          <span className="font-medium text-foreground">{accountName}</span> and
          reused when a file with the same headers is imported.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <ColumnSelect
            id="column-mapping-date"
            label="Date column"
            proposal={proposal}
            value={draft.date}
            onChange={(ref) => onChange("date", { ...draft, date: ref })}
          />
          <SourceBadge source={sources.date} />
        </div>

        <div className="space-y-1.5">
          <ColumnSelect
            id="column-mapping-payment-type"
            label="Payment type column"
            proposal={proposal}
            value={draft.paymentType}
            allowNone
            onChange={(ref) =>
              onChange("paymentType", { ...draft, paymentType: ref })
            }
          />
          <SourceBadge source={sources.paymentType} />
        </div>

        <FieldSet className="space-y-2 sm:col-span-2">
          <FieldLegend variant="label">Amount</FieldLegend>
          <ButtonGroup aria-label="Amount format">
            <Button
              type="button"
              size="sm"
              variant={amountKind === "signed" ? "default" : "outline"}
              aria-pressed={amountKind === "signed"}
              onClick={() => chooseAmountKind("signed")}
            >
              One signed column
            </Button>
            <Button
              type="button"
              size="sm"
              variant={amountKind === "split" ? "default" : "outline"}
              aria-pressed={amountKind === "split"}
              onClick={() => chooseAmountKind("split")}
            >
              Separate in and out columns
            </Button>
          </ButtonGroup>
          {amountKind === "signed" ? (
            <ColumnSelect
              id="column-mapping-amount"
              label="Amount column"
              proposal={proposal}
              value={
                draft.amount?.kind === "signed" ? draft.amount.column : null
              }
              onChange={(ref) =>
                onChange("amount", {
                  ...draft,
                  amount: ref ? { kind: "signed", column: ref } : null,
                })
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <ColumnSelect
                id="column-mapping-inflow"
                label="Money in column"
                proposal={proposal}
                value={split.inflow}
                onChange={(ref) => updateSplit({ ...split, inflow: ref })}
              />
              <ColumnSelect
                id="column-mapping-outflow"
                label="Money out column"
                proposal={proposal}
                value={split.outflow}
                onChange={(ref) => updateSplit({ ...split, outflow: ref })}
              />
            </div>
          )}
          <SourceBadge source={sources.amount} />
        </FieldSet>

        <FieldSet className="space-y-2 sm:col-span-2">
          <FieldLegend variant="label">Description columns</FieldLegend>
          <p className="text-muted-foreground text-xs">
            Checked columns are joined in file order.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {proposal.headers.map((header, index) => {
              const id = `column-mapping-description-${index}`;
              const samples = sampleValues(proposal, index);
              return (
                <Field key={id} orientation="horizontal">
                  <Checkbox
                    id={id}
                    aria-label={header}
                    checked={selectedDescription.has(index)}
                    onCheckedChange={(checked) => {
                      const next = checked
                        ? [...draft.description, { index, header }]
                        : draft.description.filter(
                            (ref) => ref.index !== index,
                          );
                      onChange("description", {
                        ...draft,
                        description: next.sort((a, b) => a.index - b.index),
                      });
                    }}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={id}>{header}</FieldLabel>
                    {samples ? (
                      <span className="text-muted-foreground text-xs">
                        {samples}
                      </span>
                    ) : null}
                  </FieldContent>
                </Field>
              );
            })}
          </div>
          <SourceBadge source={sources.description} />
        </FieldSet>
      </div>

      <section
        aria-labelledby="column-mapping-preview-heading"
        className="space-y-2"
      >
        <h3
          id="column-mapping-preview-heading"
          className="font-medium text-foreground text-sm"
        >
          Preview of the first {proposal.sampleRows.length} rows
        </h3>
        <MappingPreview proposal={proposal} draft={draft} />
      </section>

      {importError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {importError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          onClick={onConfirm}
          disabled={importLoading || completeColumnMapping(draft) === null}
          className="gap-2"
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
