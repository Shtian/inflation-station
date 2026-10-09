"use client";

// PROTOTYPE — throwaway. Variant C: outcome first. One sample transaction is
// written out as a sentence; click any part of it to pick the column it
// comes from, choosing by the value each column would give for this row.

import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatNok } from "@/lib/format-nok";
import {
  type ColumnMappingField,
  completeColumnMapping,
} from "@/lib/import/csv/column-mapping";
import { cn } from "@/lib/utils";
import {
  type MappingVariantProps,
  previewFor,
  SOURCE_LABELS,
  useMappingEditor,
} from "./shared";

function Slot({
  label,
  value,
  source,
  empty,
  tone,
  children,
}: {
  label: string;
  value: string | null;
  source: string;
  empty: string;
  tone: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "mx-1 my-1 inline-flex flex-col items-start rounded-md border-2 leading-tight border-dashed px-2 py-0.5 align-middle transition-colors hover:border-solid",
          value ? tone : "border-destructive/60 text-destructive",
        )}
      >
        <span className="font-medium font-sans text-[10px] text-muted-foreground uppercase tracking-wide">
          {label} · {source}
        </span>
        <span className="font-semibold">{value || empty}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function VariantSentence(props: MappingVariantProps) {
  const { proposal, draft, sources } = props;
  const editor = useMappingEditor(props);
  const [rowIndex, setRowIndex] = useState(0);
  const row = proposal.sampleRows[rowIndex];
  const cell = (index: number | undefined) =>
    index === undefined ? null : (row?.cells[index] ?? "").trim() || null;
  const source = (field: ColumnMappingField) => SOURCE_LABELS[sources[field]];
  const preview = previewFor(proposal, draft);
  const parsedRow = preview?.rows[rowIndex];

  const ColumnList = ({
    selected,
    onPick,
    allowNone,
    multi,
  }: {
    selected: (index: number) => boolean;
    onPick: (index: number | null) => void;
    allowNone?: boolean;
    multi?: boolean;
  }) => (
    <ul className="-mx-1 max-h-72 overflow-y-auto">
      {allowNone ? (
        <li>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="w-full rounded px-2 py-1.5 text-left text-muted-foreground text-sm hover:bg-muted"
          >
            None
          </button>
        </li>
      ) : null}
      {proposal.headers.map((header, index) => (
        <li key={header + String(index)}>
          <button
            type="button"
            onClick={() => onPick(index)}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted",
              selected(index) && "bg-muted",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center border",
                multi ? "rounded-sm" : "rounded-full",
                selected(index) &&
                  "border-primary bg-primary text-primary-foreground",
              )}
            >
              {selected(index) ? <Check className="h-3 w-3" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-muted-foreground text-xs">
                {header}
              </span>
              <span className="block truncate font-mono text-sm">
                {cell(index) ?? "—"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  const amountColumns =
    editor.amountKind === "signed"
      ? editor.columnFor("amount")?.header
      : [editor.split.inflow?.header, editor.split.outflow?.header]
          .filter(Boolean)
          .join(" / ");
  const amountText = parsedRow
    ? formatNok(parsedRow.amountNok)
    : editor.amountKind === "signed"
      ? cell(editor.columnFor("amount")?.index)
      : null;
  const descriptionText =
    draft.description
      .map((ref) => cell(ref.index))
      .filter(Boolean)
      .join(" ") || null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-1">
        <button
          type="button"
          onClick={props.onBack}
          className="flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <h2 className="font-semibold text-xl tracking-tight">
          Does this read right?
        </h2>
        <p className="text-muted-foreground text-sm">
          Here's a row from your file the way we'll import it. Click any part
          that's wrong. Saved for{" "}
          <span className="font-medium text-foreground">
            {props.accountName}
          </span>
          .
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between text-muted-foreground text-xs">
          <span>
            Row {rowIndex + 1} of {proposal.sampleRows.length}
          </span>
          <span className="flex gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Previous row"
              disabled={rowIndex === 0}
              onClick={() => setRowIndex(rowIndex - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Next row"
              disabled={rowIndex >= proposal.sampleRows.length - 1}
              onClick={() => setRowIndex(rowIndex + 1)}
            >
              <ChevronRight />
            </Button>
          </span>
        </div>

        <p className="text-lg leading-[4rem]">
          On
          <Slot
            label="Date"
            value={cell(draft.date?.index)}
            source={source("date")}
            empty="pick a date"
            tone="border-sky-500/50"
          >
            <ColumnList
              selected={(index) => draft.date?.index === index}
              onPick={(index) =>
                index === null
                  ? editor.clear("date")
                  : editor.assign(index, "date")
              }
            />
          </Slot>
          ,
          <Slot
            label={amountColumns ? `Amount (${amountColumns})` : "Amount"}
            value={amountText}
            source={source("amount")}
            empty="pick an amount"
            tone="border-emerald-500/50"
          >
            <div className="flex gap-1 rounded-md bg-muted p-0.5 text-xs">
              {(["signed", "split"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => editor.chooseAmountKind(kind)}
                  className={cn(
                    "flex-1 rounded px-2 py-1",
                    editor.amountKind === kind && "bg-background shadow-sm",
                  )}
                >
                  {kind === "signed" ? "One ± column" : "In and out columns"}
                </button>
              ))}
            </div>
            {editor.amountKind === "signed" ? (
              <ColumnList
                selected={(index) =>
                  editor.columnFor("amount")?.index === index
                }
                onPick={(index) =>
                  index === null
                    ? editor.clear("amount")
                    : editor.assign(index, "amount")
                }
              />
            ) : (
              <div className="space-y-2">
                {(["inflow", "outflow"] as const).map((role) => (
                  <div key={role}>
                    <p className="px-1 font-medium text-xs">
                      {role === "inflow" ? "Money in" : "Money out"}
                    </p>
                    <ColumnList
                      selected={(index) => editor.split[role]?.index === index}
                      onPick={(index) =>
                        index === null
                          ? editor.clear(role)
                          : editor.assign(index, role)
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </Slot>
          went to
          <Slot
            label={`Description (${draft.description.length} col)`}
            value={descriptionText}
            source={source("description")}
            empty="pick a description"
            tone="border-amber-500/50"
          >
            <p className="px-1 text-muted-foreground text-xs">
              Tick one or more. They're joined in file order.
            </p>
            <ColumnList
              multi
              selected={(index) => editor.roleOf(index) === "description"}
              onPick={(index) =>
                index !== null && editor.toggleDescription(index)
              }
            />
          </Slot>
          , paid by
          <Slot
            label="Payment type"
            value={cell(draft.paymentType?.index)}
            source={draft.paymentType ? source("paymentType") : "optional"}
            empty="—"
            tone="border-violet-500/50"
          >
            <ColumnList
              allowNone
              selected={(index) => draft.paymentType?.index === index}
              onPick={(index) =>
                index === null
                  ? editor.clear("paymentType")
                  : editor.assign(index, "paymentType")
              }
            />
          </Slot>
          .
        </p>
      </div>

      {preview && preview.errors.length > 0 ? (
        <p className="text-destructive text-sm">
          {preview.errors.length} sample row
          {preview.errors.length === 1 ? "" : "s"} won't import with this
          mapping: {preview.errors[0].message}
        </p>
      ) : null}

      {props.importError ? (
        <p role="alert" className="text-destructive text-sm">
          {props.importError}
        </p>
      ) : null}

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={props.onConfirm}
          disabled={props.importLoading || !completeColumnMapping(draft)}
          className="gap-2"
        >
          {props.importLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Looks right, continue
        </Button>
      </div>
    </div>
  );
}
