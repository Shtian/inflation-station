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
import { Input } from "@/components/ui/input";
import type {
  EditableFieldMapping,
  MerchantSignalCanonicalField,
  NormalizationFormState,
} from "../provider-mappings-manager.utils";
import {
  createEmptyFieldMapping,
  removeMappingByIndex,
  validateRegexPattern,
} from "../provider-mappings-manager.utils";
import { ProviderMappingFieldMappingsEditor } from "./provider-mapping-field-mappings-editor";
import { ProviderMappingStringBadgeInput } from "./provider-mapping-string-badge-input";

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
          <label
            htmlFor="new-provider-name"
            className="text-sm font-medium text-foreground"
          >
            Provider name
          </label>
          <Input
            id="new-provider-name"
            value={props.providerName}
            onChange={(event) => props.onProviderNameChange(event.target.value)}
            placeholder="Bank A"
          />
          <label
            htmlFor="new-mapping-version"
            className="text-sm font-medium text-foreground"
          >
            Mapping version (optional)
          </label>
          <Input
            id="new-mapping-version"
            value={props.mappingVersion}
            onChange={(event) =>
              props.onMappingVersionChange(event.target.value)
            }
            inputMode="numeric"
            placeholder="1"
          />
          <section className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Provider detection rules
              </h3>
              <p className="text-xs text-muted-foreground">
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
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
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
