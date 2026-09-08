import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

export function EditProviderMappingDialog(props: {
  open: boolean;
  editingMappingId: string | null;
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
  onCancel(): void;
  onSubmit(): void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit provider mapping</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
          <Field>
            <FieldLabel htmlFor="edit-provider-name">Provider name</FieldLabel>
            <FieldContent>
              <Input
                id="edit-provider-name"
                aria-label="Edit provider name"
                value={props.providerName}
                onChange={(event) =>
                  props.onProviderNameChange(event.target.value)
                }
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-mapping-version">
              Mapping version (optional)
            </FieldLabel>
            <FieldContent>
              <Input
                id="edit-mapping-version"
                aria-label="Edit mapping version"
                inputMode="numeric"
                value={props.mappingVersion}
                onChange={(event) =>
                  props.onMappingVersionChange(event.target.value)
                }
              />
            </FieldContent>
          </Field>
          <section className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1">
              <h4 className="font-semibold text-foreground text-sm">
                CSV format
              </h4>
              <p className="text-muted-foreground text-xs">
                How the uploaded CSV is tokenized and how its values are
                interpreted.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="edit-delimiter">Delimiter</FieldLabel>
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
                      id="edit-delimiter"
                      aria-label="Edit delimiter"
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
                <FieldLabel htmlFor="edit-decimal-separator">
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
                      id="edit-decimal-separator"
                      aria-label="Edit decimal separator"
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
                <FieldLabel htmlFor="edit-date-format">Date format</FieldLabel>
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
                      id="edit-date-format"
                      aria-label="Edit date format"
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
              <h4 className="font-semibold text-foreground text-sm">
                Provider detection rules
              </h4>
              <p className="text-muted-foreground text-xs">
                Used when matching the uploaded CSV to this provider mapping
                during import parsing.
              </p>
            </div>
            <ProviderMappingStringBadgeInput
              key={`edit-required-headers-${props.editingMappingId}`}
              id={`edit-required-headers-${props.editingMappingId}`}
              label="Required headers"
              inputAriaLabel="Edit required headers"
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
              key={`edit-any-headers-${props.editingMappingId}`}
              id={`edit-any-headers-${props.editingMappingId}`}
              label="Optional headers (any)"
              inputAriaLabel="Edit optional headers"
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
              key={`edit-header-patterns-${props.editingMappingId}`}
              id={`edit-header-patterns-${props.editingMappingId}`}
              label="Header patterns (regex)"
              inputAriaLabel="Edit header patterns"
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
            mode="edit"
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
          <Button variant="outline" onClick={props.onCancel}>
            Cancel
          </Button>
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
              "Save provider mapping"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
