"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createImportProviderMappingAction } from "@/app/actions/create-import-provider-mapping";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AddProviderMappingDialog } from "./components/add-provider-mapping-dialog";
import { EditProviderMappingDialog } from "./components/edit-provider-mapping-dialog";
import { ProviderMappingsTableSection } from "./components/provider-mappings-table-section";
import type { ProviderMapping } from "./provider-mappings-manager.types";
import type {
  EditableFieldMapping,
  MerchantSignalCanonicalField,
  NormalizationFormState,
} from "./provider-mappings-manager.utils";
import {
  buildDefaultRequiredFieldMappings,
  buildNormalizationRulesPayload,
  createEmptyNormalizationFormState,
  DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD,
  ensureRequiredFieldMappings,
  getMappingSourceValue,
  isMerchantSignalCanonicalField,
  parseMappingVersion,
  parseNormalizationFormState,
  validateFieldMappings,
} from "./provider-mappings-manager.utils";

function getProviderMappingErrorMessage(status: number, body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const code = String((body as { error: unknown }).error);

    if (status === 404 && code === "PROVIDER_MAPPING_NOT_FOUND") {
      return "Selected provider mapping was not found.";
    }

    if (status === 409 && code === "PROVIDER_MAPPING_MUST_BE_UNIQUE") {
      return "A provider mapping with this name already exists.";
    }

    if (
      status === 400 &&
      code === "REQUIRED_CANONICAL_FIELDS_MISSING" &&
      "missingCanonicalFields" in body &&
      Array.isArray(body.missingCanonicalFields)
    ) {
      return `Missing required canonical fields: ${body.missingCanonicalFields.join(", ")}.`;
    }

    if (
      status === 400 &&
      code === "DUPLICATE_CANONICAL_FIELD_MAPPINGS" &&
      "duplicateCanonicalFields" in body &&
      Array.isArray(body.duplicateCanonicalFields)
    ) {
      return `Duplicate canonical field mappings: ${body.duplicateCanonicalFields.join(", ")}.`;
    }

    if (status === 400 && code === "INVALID_PROVIDER_MAPPING_UPDATE_PAYLOAD") {
      return "Invalid provider mapping payload.";
    }

    if (status === 400 && code === "MERCHANT_SIGNAL_FIELD_REQUIRED") {
      return "At least one merchant signal field mapping is required (name or title).";
    }
  }

  return "Request failed. Please try again.";
}

function getProviderMappingActionErrorMessage(error: {
  code: string;
  details?: unknown;
}) {
  if (error.code === "PROVIDER_MAPPING_MUST_BE_UNIQUE") {
    return "A provider mapping with this name already exists.";
  }

  if (
    error.code === "REQUIRED_CANONICAL_FIELDS_MISSING" &&
    typeof error.details === "object" &&
    error.details !== null &&
    "missingCanonicalFields" in error.details &&
    Array.isArray(error.details.missingCanonicalFields)
  ) {
    return `Missing required canonical fields: ${error.details.missingCanonicalFields.join(", ")}.`;
  }

  if (
    error.code === "DUPLICATE_CANONICAL_FIELD_MAPPINGS" &&
    typeof error.details === "object" &&
    error.details !== null &&
    "duplicateCanonicalFields" in error.details &&
    Array.isArray(error.details.duplicateCanonicalFields)
  ) {
    return `Duplicate canonical field mappings: ${error.details.duplicateCanonicalFields.join(", ")}.`;
  }

  if (error.code === "MERCHANT_SIGNAL_FIELD_REQUIRED") {
    return "At least one merchant signal field mapping is required (name or title).";
  }

  if (error.code === "INVALID_PROVIDER_MAPPING_PAYLOAD") {
    return "Invalid provider mapping payload.";
  }

  return "Request failed. Please try again.";
}

export function ProviderMappingsManager() {
  const [mappings, setMappings] = useState<ProviderMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const [newProviderName, setNewProviderName] = useState("");
  const [newMappingVersion, setNewMappingVersion] = useState("");
  const [newNormalizationRules, setNewNormalizationRules] =
    useState<NormalizationFormState>(createEmptyNormalizationFormState());
  const [newFieldMappings, setNewFieldMappings] = useState<
    EditableFieldMapping[]
  >(buildDefaultRequiredFieldMappings());
  const [newMerchantSignalCanonicalField, setNewMerchantSignalCanonicalField] =
    useState<MerchantSignalCanonicalField>(
      DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD,
    );

  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [editProviderName, setEditProviderName] = useState("");
  const [editMappingVersion, setEditMappingVersion] = useState("");
  const [editNormalizationRules, setEditNormalizationRules] =
    useState<NormalizationFormState>(createEmptyNormalizationFormState());
  const [editFieldMappings, setEditFieldMappings] = useState<
    EditableFieldMapping[]
  >([]);
  const [
    editMerchantSignalCanonicalField,
    setEditMerchantSignalCanonicalField,
  ] = useState<MerchantSignalCanonicalField>(
    DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD,
  );

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/import-provider-mappings");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("mappings" in body)
    ) {
      setError("Could not load provider mappings.");
      setMappings([]);
      setLoading(false);
      return;
    }

    setMappings(
      Array.isArray(body.mappings) ? (body.mappings as ProviderMapping[]) : [],
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  function resetAddDialogState() {
    setAddDialogOpen(false);
    setNewProviderName("");
    setNewMappingVersion("");
    setNewNormalizationRules(createEmptyNormalizationFormState());
    setNewFieldMappings(buildDefaultRequiredFieldMappings());
    setNewMerchantSignalCanonicalField(DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD);
  }

  function changeNewMerchantSignalCanonicalField(
    nextCanonicalField: MerchantSignalCanonicalField,
  ) {
    const currentCanonicalField = newMerchantSignalCanonicalField;
    const currentSourceField = getMappingSourceValue(
      newFieldMappings,
      currentCanonicalField,
    );
    const existingNextSourceField = getMappingSourceValue(
      newFieldMappings,
      nextCanonicalField,
    );

    setNewFieldMappings((current) => {
      const withoutMerchantFields = current.filter(
        (fieldMapping) =>
          !isMerchantSignalCanonicalField(fieldMapping.canonicalField),
      );

      return [
        ...withoutMerchantFields,
        {
          canonicalField: nextCanonicalField,
          sourceField: existingNextSourceField || currentSourceField,
        },
      ];
    });
    setNewMerchantSignalCanonicalField(nextCanonicalField);
  }

  function changeEditMerchantSignalCanonicalField(
    nextCanonicalField: MerchantSignalCanonicalField,
  ) {
    const currentCanonicalField = editMerchantSignalCanonicalField;
    const currentSourceField = getMappingSourceValue(
      editFieldMappings,
      currentCanonicalField,
    );
    const existingNextSourceField = getMappingSourceValue(
      editFieldMappings,
      nextCanonicalField,
    );

    setEditFieldMappings((current) => {
      const withoutMerchantFields = current.filter(
        (fieldMapping) =>
          !isMerchantSignalCanonicalField(fieldMapping.canonicalField),
      );

      return [
        ...withoutMerchantFields,
        {
          canonicalField: nextCanonicalField,
          sourceField: existingNextSourceField || currentSourceField,
        },
      ];
    });
    setEditMerchantSignalCanonicalField(nextCanonicalField);
  }

  async function createMapping() {
    if (!newProviderName.trim()) {
      setError("Provider name is required.");
      return;
    }

    const fieldMappingValidationError = validateFieldMappings(newFieldMappings);
    if (fieldMappingValidationError) {
      setError(fieldMappingValidationError);
      return;
    }

    const parsedVersion = parseMappingVersion(newMappingVersion);
    if ("error" in parsedVersion) {
      setError(parsedVersion.error);
      return;
    }

    setBusyKey("new");
    setError(null);

    const result = await createImportProviderMappingAction({
      providerName: newProviderName.trim(),
      normalizationRules: buildNormalizationRulesPayload(newNormalizationRules),
      mappingVersion: parsedVersion.value,
      fieldMappings: newFieldMappings.map((fieldMapping) => ({
        sourceField: fieldMapping.sourceField.trim(),
        canonicalField: fieldMapping.canonicalField.trim(),
      })),
    });

    if (!result.ok) {
      setError(getProviderMappingActionErrorMessage(result.error));
      setBusyKey(null);
      return;
    }

    resetAddDialogState();
    setBusyKey(null);
    toast.success("Provider mapping added.");
    await loadMappings();
  }

  function startEdit(mapping: ProviderMapping) {
    const merchantSignalCanonicalField = mapping.fieldMappings.some(
      (fieldMapping) => fieldMapping.canonicalField === "name",
    )
      ? "name"
      : DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD;

    setEditingMappingId(mapping.id);
    setEditProviderName(mapping.providerName);
    setEditMappingVersion(
      mapping.mappingVersion ? String(mapping.mappingVersion) : "",
    );
    setEditNormalizationRules(
      parseNormalizationFormState(mapping.normalizationRules),
    );
    setEditMerchantSignalCanonicalField(merchantSignalCanonicalField);
    setEditFieldMappings(
      ensureRequiredFieldMappings(
        mapping.fieldMappings.map((fieldMapping) => ({
          sourceField: fieldMapping.sourceField,
          canonicalField: fieldMapping.canonicalField,
        })),
        merchantSignalCanonicalField,
      ),
    );
    setError(null);
  }

  function cancelEdit() {
    setEditingMappingId(null);
    setEditProviderName("");
    setEditMappingVersion("");
    setEditNormalizationRules(createEmptyNormalizationFormState());
    setEditFieldMappings([]);
    setEditMerchantSignalCanonicalField(
      DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD,
    );
    setError(null);
  }

  async function saveEdit(mappingId: string) {
    if (!editProviderName.trim()) {
      setError("Provider name is required.");
      return;
    }

    const fieldMappingValidationError =
      validateFieldMappings(editFieldMappings);
    if (fieldMappingValidationError) {
      setError(fieldMappingValidationError);
      return;
    }

    const parsedVersion = parseMappingVersion(editMappingVersion);
    if ("error" in parsedVersion) {
      setError(parsedVersion.error);
      return;
    }

    setBusyKey(mappingId);
    setError(null);

    const response = await fetch(`/api/import-provider-mappings/${mappingId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerName: editProviderName.trim(),
        normalizationRules: buildNormalizationRulesPayload(
          editNormalizationRules,
        ),
        mappingVersion: parsedVersion.value,
        fieldMappings: editFieldMappings.map((fieldMapping) => ({
          sourceField: fieldMapping.sourceField.trim(),
          canonicalField: fieldMapping.canonicalField.trim(),
        })),
      }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(getProviderMappingErrorMessage(response.status, body));
      setBusyKey(null);
      return;
    }

    setBusyKey(null);
    setEditingMappingId(null);
    toast.success("Provider mapping updated.");
    await loadMappings();
  }

  async function deleteMapping(mappingId: string) {
    if (!window.confirm("Delete this provider mapping?")) {
      return;
    }

    setBusyKey(`delete-${mappingId}`);
    setError(null);

    const response = await fetch(`/api/import-provider-mappings/${mappingId}`, {
      method: "DELETE",
    });
    const body = await response.json().catch(() => null);

    if (!response.ok && response.status !== 204) {
      setError(getProviderMappingErrorMessage(response.status, body));
      setBusyKey(null);
      return;
    }

    if (editingMappingId === mappingId) {
      cancelEdit();
    }

    setBusyKey(null);
    toast.success("Provider mapping removed.");
    await loadMappings();
  }

  function handleAddDialogOpenChange(open: boolean) {
    if (!open) {
      resetAddDialogState();
      setError(null);
      return;
    }

    setAddDialogOpen(true);
  }

  function handleEditDialogOpenChange(open: boolean) {
    if (!open) {
      cancelEdit();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl text-foreground tracking-tight">
            Provider mappings
          </h1>
          <p className="text-muted-foreground text-sm">
            Configure source-column to canonical-field assignments and
            normalization rules for CSV providers.
          </p>
        </div>
        <Button
          onClick={() => {
            setAddDialogOpen(true);
          }}
          className="shrink-0 gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add provider mapping
        </Button>
      </div>

      <AddProviderMappingDialog
        open={addDialogOpen}
        error={error && addDialogOpen ? error : null}
        busy={busyKey === "new"}
        providerName={newProviderName}
        mappingVersion={newMappingVersion}
        normalizationRules={newNormalizationRules}
        fieldMappings={newFieldMappings}
        merchantSignalCanonicalField={newMerchantSignalCanonicalField}
        onOpenChange={handleAddDialogOpenChange}
        onProviderNameChange={setNewProviderName}
        onMappingVersionChange={setNewMappingVersion}
        onNormalizationRulesChange={setNewNormalizationRules}
        onFieldMappingsChange={setNewFieldMappings}
        onMerchantSignalCanonicalFieldChange={
          changeNewMerchantSignalCanonicalField
        }
        onSubmit={() => void createMapping()}
      />

      <EditProviderMappingDialog
        open={editingMappingId !== null}
        editingMappingId={editingMappingId}
        error={error && editingMappingId !== null ? error : null}
        busy={busyKey === editingMappingId}
        providerName={editProviderName}
        mappingVersion={editMappingVersion}
        normalizationRules={editNormalizationRules}
        fieldMappings={editFieldMappings}
        merchantSignalCanonicalField={editMerchantSignalCanonicalField}
        onOpenChange={handleEditDialogOpenChange}
        onProviderNameChange={setEditProviderName}
        onMappingVersionChange={setEditMappingVersion}
        onNormalizationRulesChange={setEditNormalizationRules}
        onFieldMappingsChange={setEditFieldMappings}
        onMerchantSignalCanonicalFieldChange={
          changeEditMerchantSignalCanonicalField
        }
        onCancel={cancelEdit}
        onSubmit={() => {
          if (editingMappingId) {
            void saveEdit(editingMappingId);
          }
        }}
      />

      {error && !addDialogOpen && editingMappingId === null ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm"
        >
          {error}
        </p>
      ) : null}

      <Separator className="my-4" />

      <ProviderMappingsTableSection
        loading={loading}
        mappings={mappings}
        busyKey={busyKey}
        onEdit={startEdit}
        onDelete={(mappingId) => {
          void deleteMapping(mappingId);
        }}
      />
    </div>
  );
}
