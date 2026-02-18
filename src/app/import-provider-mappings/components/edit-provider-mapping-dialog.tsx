import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          <Label
            htmlFor="edit-provider-name"
            className="text-sm font-medium text-foreground"
          >
            Provider name
          </Label>
          <Input
            id="edit-provider-name"
            aria-label="Edit provider name"
            value={props.providerName}
            onChange={(event) => props.onProviderNameChange(event.target.value)}
          />
          <Label
            htmlFor="edit-mapping-version"
            className="text-sm font-medium text-foreground"
          >
            Mapping version (optional)
          </Label>
          <Input
            id="edit-mapping-version"
            aria-label="Edit mapping version"
            inputMode="numeric"
            value={props.mappingVersion}
            onChange={(event) =>
              props.onMappingVersionChange(event.target.value)
            }
          />
          <section className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                Provider detection rules
              </h4>
              <p className="text-xs text-muted-foreground">
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
