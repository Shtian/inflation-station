"use client";

// PROTOTYPE — throwaway. Variant B: map from the file's side. The raw CSV is
// the screen; each column gets a role picker in its header.

import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNok } from "@/lib/format-nok";
import { completeColumnMapping } from "@/lib/import/csv/column-mapping";
import { cn } from "@/lib/utils";
import {
  type MappingVariantProps,
  previewFor,
  ROLE_LABELS,
  type Role,
  SOURCE_LABELS,
  useMappingEditor,
} from "./shared";

const ROLES: Role[] = [
  "ignore",
  "date",
  "amount",
  "inflow",
  "outflow",
  "description",
  "paymentType",
];

const ROLE_TINT: Record<Role, string> = {
  date: "bg-sky-500/10",
  amount: "bg-emerald-500/10",
  inflow: "bg-emerald-500/10",
  outflow: "bg-rose-500/10",
  description: "bg-amber-500/10",
  paymentType: "bg-violet-500/10",
  ignore: "",
};

const ROLE_FIELD = {
  date: "date",
  amount: "amount",
  inflow: "amount",
  outflow: "amount",
  description: "description",
  paymentType: "paymentType",
} as const;

export function VariantSpreadsheet(props: MappingVariantProps) {
  const { proposal, draft, sources } = props;
  const editor = useMappingEditor(props);
  const preview = previewFor(proposal, draft);
  const items = ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  const missing = [
    !draft.date && "a date",
    !draft.amount &&
      (editor.amountKind === "split" ? "both money in and out" : "an amount"),
    draft.description.length === 0 && "a description",
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={props.onBack}
            className="flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <h2 className="font-semibold text-xl tracking-tight">
            What's in each column?
          </h2>
          <p className="text-muted-foreground text-sm">
            Tag the columns you need. Everything else is ignored. Saved for{" "}
            <span className="font-medium text-foreground">
              {props.accountName}
            </span>
            .
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p
            className={cn(
              "text-sm",
              missing.length ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {missing.length ? `Still needs ${missing.join(", ")}` : "Ready"}
          </p>
          <Button
            onClick={props.onConfirm}
            disabled={props.importLoading || !completeColumnMapping(draft)}
            className="gap-2"
          >
            {props.importLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Confirm mapping
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              {proposal.headers.map((header, index) => {
                const role = editor.roleOf(index);
                return (
                  <th
                    key={header + String(index)}
                    className={cn(
                      "min-w-40 px-2 pt-2 pb-1 text-left align-top",
                      ROLE_TINT[role],
                    )}
                  >
                    <Select
                      items={items}
                      value={role}
                      onValueChange={(next) =>
                        editor.assign(index, (next ?? "ignore") as Role)
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label={`Role of ${header}`}
                        className={cn(
                          "w-full",
                          role === "ignore" && "text-muted-foreground",
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="mt-1 block h-4 font-normal text-[10px] text-muted-foreground uppercase tracking-wide">
                      {role === "ignore"
                        ? ""
                        : SOURCE_LABELS[sources[ROLE_FIELD[role]]]}
                    </span>
                  </th>
                );
              })}
            </tr>
            <tr className="border-b">
              {proposal.headers.map((header, index) => (
                <th
                  key={header + String(index)}
                  className={cn(
                    "px-3 py-2 text-left font-medium font-mono text-xs",
                    ROLE_TINT[editor.roleOf(index)],
                    editor.roleOf(index) === "ignore" &&
                      "text-muted-foreground/60",
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proposal.sampleRows.map((row) => (
              <tr key={row.sourceRowNumber} className="border-b last:border-0">
                {proposal.headers.map((header, index) => {
                  const role = editor.roleOf(index);
                  return (
                    <td
                      key={header + String(index)}
                      className={cn(
                        "max-w-56 truncate px-3 py-1.5 font-mono text-xs",
                        ROLE_TINT[role],
                        role === "ignore" && "text-muted-foreground/50",
                      )}
                    >
                      {row.cells[index]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1.5">
        <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Imports as
        </h3>
        {preview ? (
          <ul className="divide-y rounded-lg border text-sm">
            {preview.rows.slice(0, 3).map((row, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: prototype
              <li key={index} className="flex gap-4 px-3 py-1.5">
                <span className="w-24 font-mono text-xs">
                  {row.bookingDate}
                </span>
                <span className="flex-1 truncate">{row.title}</span>
                <span className="text-muted-foreground">{row.paymentType}</span>
                <span className="w-28 text-right font-mono text-xs">
                  {formatNok(row.amountNok)}
                </span>
              </li>
            ))}
            {preview.errors.slice(0, 2).map((error) => (
              <li
                key={`${error.rowNumber}-${error.code}`}
                className="px-3 py-1.5 text-destructive text-xs"
              >
                {error.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            Tag a date, an amount and a description to see how rows import.
          </p>
        )}
      </div>

      {props.importError ? (
        <p role="alert" className="text-destructive text-sm">
          {props.importError}
        </p>
      ) : null}
    </div>
  );
}
