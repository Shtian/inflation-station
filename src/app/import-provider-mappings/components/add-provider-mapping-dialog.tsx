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
import type {
  EditableFieldMapping,
  MerchantSignalCanonicalField,
  NormalizationFormState,
} from "../provider-mappings-manager.utils";
import {
  createEmptyFieldMapping,
  removeMappingByIndex,
} from "../provider-mappings-manager.utils";
import { ProviderMappingFieldMappingsEditor } from "./provider-mapping-field-mappings-editor";
import { ProviderMappingNormalizationRulesSection } from "./provider-mapping-normalization-rules-section";

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
          <ProviderMappingNormalizationRulesSection
            idPrefix="new"
            normalizationRules={props.normalizationRules}
            onChange={props.onNormalizationRulesChange}
          />
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
