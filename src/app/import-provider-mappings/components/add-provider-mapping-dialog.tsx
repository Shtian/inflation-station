import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUPPORTED_PROVIDER_DATE_FORMATS,
  SUPPORTED_PROVIDER_DECIMAL_SEPARATORS,
  SUPPORTED_PROVIDER_DELIMITERS,
} from "../../../lib/import/provider-adapter/mapping-definition";
import type {
  EditableFieldMapping,
  MerchantSignalCanonicalField,
  NormalizationFormState,
} from "../provider-mappings-manager.utils";
import {
  createEmptyFieldMapping,
  INFER_DELIMITER_OPTION,
  removeMappingByIndex,
  upsertMappingTransforms,
  validateRegexPattern,
} from "../provider-mappings-manager.utils";
import { ProviderMappingFieldMappingsEditor } from "./provider-mapping-field-mappings-editor";
import { ProviderMappingStringBadgeInput } from "./provider-mapping-string-badge-input";

const DELIMITER_LABELS: Record<string, string> = {
  ";": "Semicolon ( ; )",
  ",": "Comma ( , )",
};

export function AddProviderMappingDialog(props: {
  open: boolean;
  error: string | null;
  busy: boolean;
  providerName: string;
  mappingVersion: string;
  normalizationRules: NormalizationFormState;
  fieldMappings: EditableFieldMapping[];
  merchantSignalCanonicalField: MerchantSignalCanonicalField;
  onOpenChange(open: boolean): void;
  onProviderNameChange(value: string): void;
  onMappingVersionChange(value: string): void;
  onNormalizationRulesChange(value: NormalizationFormState): void;
  onFieldMappingsChange(value: EditableFieldMapping[]): void;
  onMerchantSignalCanonicalFieldChange(
    value: MerchantSignalCanonicalField,
  ): void;
  onSubmit(): void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add provider mapping</DialogTitle>
          <DialogDescription>
            Configure source-column to canonical-field assignments and
            normalization rules for a new CSV provider.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
          <Field>
            <FieldLabel htmlFor="new-provider-name">Provider name</FieldLabel>
            <FieldContent>
              <Input
                id="new-provider-name"
                value={props.providerName}
                onChange={(event) =>
                  props.onProviderNameChange(event.target.value)
                }
                placeholder="Bank A"
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="new-mapping-version">
              Mapping version (optional)
            </FieldLabel>
            <FieldContent>
              <Input
                id="new-mapping-version"
                value={props.mappingVersion}
                onChange={(event) =>
                  props.onMappingVersionChange(event.target.value)
                }
                inputMode="numeric"
                placeholder="1"
              />
            </FieldContent>
          </Field>
          <section className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-sm">
                CSV format
              </h3>
              <p className="text-muted-foreground text-xs">
                How the uploaded CSV is tokenized and how its values are
                interpreted.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="new-delimiter">Delimiter</FieldLabel>
                <FieldContent>
                  <Select
                    value={props.normalizationRules.delimiter}
                    onValueChange={(value) =>
                      props.onNormalizationRulesChange({
                        ...props.normalizationRules,
                        delimiter: value as NormalizationFormState["delimiter"],
                      })
                    }
                  >
                    <SelectTrigger
                      id="new-delimiter"
                      aria-label="Delimiter"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={INFER_DELIMITER_OPTION}>
                        Infer from file
                      </SelectItem>
                      {SUPPORTED_PROVIDER_DELIMITERS.map((delimiter) => (
                        <SelectItem key={delimiter} value={delimiter}>
                          {DELIMITER_LABELS[delimiter] ?? delimiter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-decimal-separator">
                  Decimal separator
                </FieldLabel>
                <FieldContent>
                  <Select
                    value={props.normalizationRules.decimalSeparator}
                    onValueChange={(value) =>
                      props.onNormalizationRulesChange({
                        ...props.normalizationRules,
                        decimalSeparator:
                          value as NormalizationFormState["decimalSeparator"],
                      })
                    }
                  >
                    <SelectTrigger
                      id="new-decimal-separator"
                      aria-label="Decimal separator"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_PROVIDER_DECIMAL_SEPARATORS.map(
                        (separator) => (
                          <SelectItem key={separator} value={separator}>
                            {separator}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-date-format">Date format</FieldLabel>
                <FieldContent>
                  <Select
                    value={props.normalizationRules.dateFormat}
                    onValueChange={(value) =>
                      props.onNormalizationRulesChange({
                        ...props.normalizationRules,
                        dateFormat:
                          value as NormalizationFormState["dateFormat"],
                      })
                    }
                  >
                    <SelectTrigger
                      id="new-date-format"
                      aria-label="Date format"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_PROVIDER_DATE_FORMATS.map((dateFormat) => (
                        <SelectItem key={dateFormat} value={dateFormat}>
                          {dateFormat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
            </div>
          </section>
          <section className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-sm">
                Provider detection rules
              </h3>
              <p className="text-muted-foreground text-xs">
                Used when matching the uploaded CSV to a provider mapping during
                import parsing.
              </p>
            </div>
            <ProviderMappingStringBadgeInput
              id="new-required-headers"
              label="Required headers"
              inputAriaLabel="Add required header"
              placeholder="Type header and press Enter"
              values={props.normalizationRules.requiredHeaders}
              onChange={(values) =>
                props.onNormalizationRulesChange({
                  ...props.normalizationRules,
                  requiredHeaders: values,
                })
              }
            />
            <ProviderMappingStringBadgeInput
              id="new-any-headers"
              label="Optional headers (any)"
              inputAriaLabel="Add optional header"
              placeholder="Type header and press Enter"
              values={props.normalizationRules.anyHeaders}
              onChange={(values) =>
                props.onNormalizationRulesChange({
                  ...props.normalizationRules,
                  anyHeaders: values,
                })
              }
            />
            <ProviderMappingStringBadgeInput
              id="new-header-patterns"
              label="Header patterns (regex)"
              inputAriaLabel="Add header pattern"
              placeholder="Type regex and press Enter"
              values={props.normalizationRules.headerPatterns}
              onChange={(values) =>
                props.onNormalizationRulesChange({
                  ...props.normalizationRules,
                  headerPatterns: values,
                })
              }
              validator={validateRegexPattern}
            />
          </section>
          <ProviderMappingFieldMappingsEditor
            mode="new"
            fieldMappings={props.fieldMappings}
            merchantSignalCanonicalField={props.merchantSignalCanonicalField}
            onMerchantSignalCanonicalFieldChange={
              props.onMerchantSignalCanonicalFieldChange
            }
            onRequiredMappingChange={(canonicalField, sourceField) =>
              props.onFieldMappingsChange(
                props.fieldMappings.map((fieldMapping) =>
                  fieldMapping.canonicalField === canonicalField
                    ? { ...fieldMapping, sourceField }
                    : fieldMapping,
                ),
              )
            }
            onRequiredTransformsChange={(canonicalField, transforms) =>
              props.onFieldMappingsChange(
                upsertMappingTransforms(
                  props.fieldMappings,
                  canonicalField,
                  transforms,
                ),
              )
            }
            onOptionalCanonicalFieldChange={(index, value) =>
              props.onFieldMappingsChange(
                props.fieldMappings.map((fieldMapping, fieldMappingIndex) =>
                  fieldMappingIndex === index
                    ? { ...fieldMapping, canonicalField: value }
                    : fieldMapping,
                ),
              )
            }
            onOptionalSourceFieldChange={(index, value) =>
              props.onFieldMappingsChange(
                props.fieldMappings.map((fieldMapping, fieldMappingIndex) =>
                  fieldMappingIndex === index
                    ? { ...fieldMapping, sourceField: value }
                    : fieldMapping,
                ),
              )
            }
            onOptionalTransformsChange={(index, transforms) =>
              props.onFieldMappingsChange(
                props.fieldMappings.map((fieldMapping, fieldMappingIndex) =>
                  fieldMappingIndex === index
                    ? { ...fieldMapping, transforms }
                    : fieldMapping,
                ),
              )
            }
            onOptionalRemove={(index) =>
              props.onFieldMappingsChange(
                removeMappingByIndex(props.fieldMappings, index),
              )
            }
            onOptionalAdd={() =>
              props.onFieldMappingsChange([
                ...props.fieldMappings,
                createEmptyFieldMapping(),
              ])
            }
          />

          {props.error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
            >
              {props.error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            onClick={props.onSubmit}
            disabled={props.busy}
            className="gap-2"
          >
            {props.busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create provider mapping
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
