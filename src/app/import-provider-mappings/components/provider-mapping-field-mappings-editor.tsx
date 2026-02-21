import { ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EditableFieldMapping,
  MerchantSignalCanonicalField,
} from "../provider-mappings-manager.utils";
import {
  getMappingSourceValue,
  isRequiredCanonicalField,
  MERCHANT_SIGNAL_CANONICAL_FIELDS,
  OPTIONAL_CANONICAL_FIELDS,
} from "../provider-mappings-manager.utils";

export function ProviderMappingFieldMappingsEditor(props: {
  mode: "new" | "edit";
  fieldMappings: EditableFieldMapping[];
  merchantSignalCanonicalField: MerchantSignalCanonicalField;
  onMerchantSignalCanonicalFieldChange(
    value: MerchantSignalCanonicalField,
  ): void;
  onRequiredMappingChange(canonicalField: string, sourceField: string): void;
  onOptionalCanonicalFieldChange(index: number, value: string): void;
  onOptionalSourceFieldChange(index: number, value: string): void;
  onOptionalRemove(index: number): void;
  onOptionalAdd(): void;
}) {
  const optionalRows = props.fieldMappings
    .map((fieldMapping, index) => ({ fieldMapping, index }))
    .filter(
      ({ fieldMapping }) =>
        !isRequiredCanonicalField(fieldMapping.canonicalField) &&
        fieldMapping.canonicalField !== props.merchantSignalCanonicalField,
    );

  const isEdit = props.mode === "edit";
  const requiredBookingDateLabel = isEdit
    ? "Edit required source field bookingDate"
    : "Required source field bookingDate";
  const requiredAmountLabel = isEdit
    ? "Edit required source field amount"
    : "Required source field amount";
  const requiredMerchantSignalFieldLabel = isEdit
    ? "Edit required merchant signal field"
    : "Required merchant signal field";
  const requiredMerchantSignalSourceLabel = isEdit
    ? "Edit required source field merchant signal"
    : "Required source field merchant signal";

  return (
    <section className="space-y-3 rounded-md border border-border p-3">
      <h4 className="font-semibold text-foreground text-sm">Field mappings</h4>
      <section className="space-y-2 rounded-md border border-border p-3">
        <h4 className="font-semibold text-foreground text-xs uppercase tracking-wide">
          Required mappings
        </h4>
        <p className="text-muted-foreground text-xs">
          Required: booking date, amount, and one merchant signal field.
        </p>
        <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)]">
          <span className="font-medium text-muted-foreground text-xs">
            Destination
          </span>
          <span />
          <span className="font-medium text-muted-foreground text-xs">
            Source
          </span>
          <Input value="bookingDate" disabled className="w-full" />
          <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
          <div className="relative">
            <Input
              aria-label={requiredBookingDateLabel}
              value={getMappingSourceValue(props.fieldMappings, "bookingDate")}
              onChange={(event) =>
                props.onRequiredMappingChange("bookingDate", event.target.value)
              }
              placeholder="Source column for booking date"
              className="w-full pr-8"
            />
            {getMappingSourceValue(
              props.fieldMappings,
              "bookingDate",
            ).trim() ? (
              <Check
                className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-emerald-600"
                aria-hidden="true"
              />
            ) : null}
          </div>
          <Input value="amount" disabled className="w-full" />
          <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
          <div className="relative">
            <Input
              aria-label={requiredAmountLabel}
              value={getMappingSourceValue(props.fieldMappings, "amount")}
              onChange={(event) =>
                props.onRequiredMappingChange("amount", event.target.value)
              }
              placeholder="Source column for amount"
              className="w-full pr-8"
            />
            {getMappingSourceValue(props.fieldMappings, "amount").trim() ? (
              <Check
                className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-emerald-600"
                aria-hidden="true"
              />
            ) : null}
          </div>
          <Select
            value={props.merchantSignalCanonicalField}
            onValueChange={(value) =>
              props.onMerchantSignalCanonicalFieldChange(
                value as MerchantSignalCanonicalField,
              )
            }
          >
            <SelectTrigger
              aria-label={requiredMerchantSignalFieldLabel}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MERCHANT_SIGNAL_CANONICAL_FIELDS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
          <div className="relative">
            <Input
              aria-label={requiredMerchantSignalSourceLabel}
              value={getMappingSourceValue(
                props.fieldMappings,
                props.merchantSignalCanonicalField,
              )}
              onChange={(event) =>
                props.onRequiredMappingChange(
                  props.merchantSignalCanonicalField,
                  event.target.value,
                )
              }
              placeholder="Source column for merchant signal"
              className="w-full pr-8"
            />
            {getMappingSourceValue(
              props.fieldMappings,
              props.merchantSignalCanonicalField,
            ).trim() ? (
              <Check
                className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-emerald-600"
                aria-hidden="true"
              />
            ) : null}
          </div>
        </div>
      </section>
      <section className="space-y-2 rounded-md border border-border p-3">
        <h4 className="font-semibold text-foreground text-xs uppercase tracking-wide">
          Optional mappings
        </h4>
        <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)_auto]">
          <span className="font-medium text-muted-foreground text-xs">
            Destination
          </span>
          <span />
          <span className="font-medium text-muted-foreground text-xs">
            Source
          </span>
          <span />
          {optionalRows.length === 0 ? (
            <p className="text-muted-foreground text-xs md:col-span-4">
              No optional mappings added.
            </p>
          ) : (
            optionalRows.map(({ fieldMapping, index }) => {
              const canonicalLabel = isEdit
                ? `Edit optional canonical field ${index + 1}`
                : `Optional canonical field ${index + 1}`;
              const sourceLabel = isEdit
                ? `Edit optional source column ${index + 1}`
                : `Optional source column ${index + 1}`;
              const removeLabel = isEdit
                ? `Remove edit optional mapping row ${index + 1}`
                : `Remove optional mapping row ${index + 1}`;

              return (
                <div
                  key={`${props.mode}-optional-${index + 1}`}
                  className="contents"
                >
                  <Select
                    value={fieldMapping.canonicalField}
                    onValueChange={(value) =>
                      props.onOptionalCanonicalFieldChange(index, value)
                    }
                  >
                    <SelectTrigger
                      aria-label={canonicalLabel}
                      className="w-full"
                    >
                      <SelectValue placeholder="Select canonical field" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPTIONAL_CANONICAL_FIELDS.filter(
                        (option) =>
                          option !== props.merchantSignalCanonicalField &&
                          !isRequiredCanonicalField(option),
                      ).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label={sourceLabel}
                    value={fieldMapping.sourceField}
                    onChange={(event) =>
                      props.onOptionalSourceFieldChange(
                        index,
                        event.target.value,
                      )
                    }
                    placeholder="Source column"
                    className="w-full"
                  />
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    aria-label={removeLabel}
                    onClick={() => props.onOptionalRemove(index)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
        <Button
          variant="outline"
          onClick={props.onOptionalAdd}
          className="gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add optional mapping
        </Button>
      </section>
    </section>
  );
}
