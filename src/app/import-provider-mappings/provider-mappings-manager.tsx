"use client";

import {
  ArrowRight,
  Check,
  Ellipsis,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EditableFieldMapping,
  MerchantSignalCanonicalField,
  NormalizationFormState,
} from "./provider-mappings-manager.utils";
import {
  buildDefaultRequiredFieldMappings,
  buildNormalizationRulesPayload,
  createEmptyFieldMapping,
  createEmptyNormalizationFormState,
  DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD,
  ensureRequiredFieldMappings,
  getMappingSourceValue,
  isMerchantSignalCanonicalField,
  isRequiredCanonicalField,
  MERCHANT_SIGNAL_CANONICAL_FIELDS,
  mergeStringList,
  OPTIONAL_CANONICAL_FIELDS,
  parseMappingVersion,
  parseNormalizationFormState,
  removeMappingByIndex,
  removeStringListValue,
  upsertMappingValue,
  validateFieldMappings,
  validateRegexPattern,
} from "./provider-mappings-manager.utils";

type ProviderFieldMapping = {
  id: string;
  sourceField: string;
  canonicalField: string;
  transformRules: unknown;
};

type ProviderMapping = {
  id: string;
  providerName: string;
  normalizationRules: unknown;
  mappingVersion: number | null;
  fieldMappings: ProviderFieldMapping[];
};

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

    if (
      status === 400 &&
      (code === "INVALID_PROVIDER_MAPPING_PAYLOAD" ||
        code === "INVALID_PROVIDER_MAPPING_UPDATE_PAYLOAD")
    ) {
      return "Invalid provider mapping payload.";
    }

    if (status === 400 && code === "MERCHANT_SIGNAL_FIELD_REQUIRED") {
      return "At least one merchant signal field mapping is required (name or title).";
    }
  }

  return "Request failed. Please try again.";
}

function StringBadgeInput(props: {
  id: string;
  label: string;
  inputAriaLabel: string;
  placeholder: string;
  values: string[];
  onChange(values: string[]): void;
  validator?(value: string): string | null;
}) {
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const addValue = useCallback(
    (candidate: string) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return;
      }

      if (props.validator) {
        const validationError = props.validator(trimmed);
        if (validationError) {
          setInputError(validationError);
          return;
        }
      }

      props.onChange(mergeStringList(props.values, trimmed));
      setInputValue("");
      setInputError(null);
    },
    [props],
  );

  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="text-sm font-medium text-foreground">
        {props.label}
      </label>
      <Input
        id={props.id}
        aria-label={props.inputAriaLabel}
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value);
          if (inputError) {
            setInputError(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addValue(inputValue);
          }
        }}
        placeholder={props.placeholder}
      />
      {inputError ? (
        <p className="text-xs text-red-700" role="alert">
          {inputError}
        </p>
      ) : null}
      {props.values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {props.values.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="animate-in fade-in-0 slide-in-from-top-1 duration-200 gap-1"
            >
              <span>{value}</span>
              <button
                type="button"
                aria-label={`Remove ${value}`}
                className="rounded-full p-0.5 hover:bg-black/10"
                onClick={() =>
                  props.onChange(removeStringListValue(props.values, value))
                }
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No values added yet.</p>
      )}
    </div>
  );
}

export function ProviderMappingsManager() {
  const [mappings, setMappings] = useState<ProviderMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const newOptionalFieldMappingRows = useMemo(
    () =>
      newFieldMappings
        .map((fieldMapping, index) => ({ fieldMapping, index }))
        .filter(
          ({ fieldMapping }) =>
            !isRequiredCanonicalField(fieldMapping.canonicalField) &&
            fieldMapping.canonicalField !== newMerchantSignalCanonicalField,
        ),
    [newFieldMappings, newMerchantSignalCanonicalField],
  );
  const editOptionalFieldMappingRows = useMemo(
    () =>
      editFieldMappings
        .map((fieldMapping, index) => ({ fieldMapping, index }))
        .filter(
          ({ fieldMapping }) =>
            !isRequiredCanonicalField(fieldMapping.canonicalField) &&
            fieldMapping.canonicalField !== editMerchantSignalCanonicalField,
        ),
    [editFieldMappings, editMerchantSignalCanonicalField],
  );

  function updateNewRequiredMapping(
    canonicalField: string,
    sourceField: string,
  ) {
    setNewFieldMappings((current) =>
      upsertMappingValue(current, canonicalField, sourceField),
    );
  }

  function updateEditRequiredMapping(
    canonicalField: string,
    sourceField: string,
  ) {
    setEditFieldMappings((current) =>
      upsertMappingValue(current, canonicalField, sourceField),
    );
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
      setNotice(null);
      return;
    }

    const fieldMappingValidationError = validateFieldMappings(newFieldMappings);
    if (fieldMappingValidationError) {
      setError(fieldMappingValidationError);
      setNotice(null);
      return;
    }

    const parsedVersion = parseMappingVersion(newMappingVersion);
    if ("error" in parsedVersion) {
      setError(parsedVersion.error);
      setNotice(null);
      return;
    }

    setBusyKey("new");
    setError(null);
    setNotice(null);

    const response = await fetch("/api/import-provider-mappings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerName: newProviderName.trim(),
        normalizationRules: buildNormalizationRulesPayload(
          newNormalizationRules,
        ),
        mappingVersion: parsedVersion.value,
        fieldMappings: newFieldMappings.map((fieldMapping) => ({
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

    setAddDialogOpen(false);
    setNewProviderName("");
    setNewMappingVersion("");
    setNewNormalizationRules(createEmptyNormalizationFormState());
    setNewFieldMappings(buildDefaultRequiredFieldMappings());
    setNewMerchantSignalCanonicalField(DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD);
    setBusyKey(null);
    setNotice("Provider mapping added.");
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
    setNotice(null);
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
      setNotice(null);
      return;
    }

    const fieldMappingValidationError =
      validateFieldMappings(editFieldMappings);
    if (fieldMappingValidationError) {
      setError(fieldMappingValidationError);
      setNotice(null);
      return;
    }

    const parsedVersion = parseMappingVersion(editMappingVersion);
    if ("error" in parsedVersion) {
      setError(parsedVersion.error);
      setNotice(null);
      return;
    }

    setBusyKey(mappingId);
    setError(null);
    setNotice(null);

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
    setNotice("Provider mapping updated.");
    await loadMappings();
  }

  async function deleteMapping(mappingId: string) {
    if (!window.confirm("Delete this provider mapping?")) {
      return;
    }

    setBusyKey(`delete-${mappingId}`);
    setError(null);
    setNotice(null);

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
    setNotice("Provider mapping removed.");
    await loadMappings();
  }

  function handleAddDialogOpenChange(open: boolean) {
    if (!open) {
      setAddDialogOpen(false);
      setNewProviderName("");
      setNewMappingVersion("");
      setNewNormalizationRules(createEmptyNormalizationFormState());
      setNewFieldMappings(buildDefaultRequiredFieldMappings());
      setNewMerchantSignalCanonicalField(
        DEFAULT_MERCHANT_SIGNAL_CANONICAL_FIELD,
      );
      setError(null);
    } else {
      setAddDialogOpen(true);
    }
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Provider mappings
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure source-column to canonical-field assignments and
            normalization rules for CSV providers.
          </p>
        </div>
        <Button
          onClick={() => {
            setNotice(null);
            setAddDialogOpen(true);
          }}
          className="shrink-0 gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add provider mapping
        </Button>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={handleAddDialogOpenChange}>
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
              value={newProviderName}
              onChange={(event) => setNewProviderName(event.target.value)}
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
              value={newMappingVersion}
              onChange={(event) => setNewMappingVersion(event.target.value)}
              inputMode="numeric"
              placeholder="1"
            />
            <section className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Provider detection rules
                </h3>
                <p className="text-xs text-muted-foreground">
                  Used when matching the uploaded CSV to a provider mapping
                  during import parsing.
                </p>
              </div>
              <StringBadgeInput
                id="new-required-headers"
                label="Required headers"
                inputAriaLabel="Add required header"
                placeholder="Type header and press Enter"
                values={newNormalizationRules.requiredHeaders}
                onChange={(values) =>
                  setNewNormalizationRules((current) => ({
                    ...current,
                    requiredHeaders: values,
                  }))
                }
              />
              <StringBadgeInput
                id="new-any-headers"
                label="Optional headers (any)"
                inputAriaLabel="Add optional header"
                placeholder="Type header and press Enter"
                values={newNormalizationRules.anyHeaders}
                onChange={(values) =>
                  setNewNormalizationRules((current) => ({
                    ...current,
                    anyHeaders: values,
                  }))
                }
              />
              <StringBadgeInput
                id="new-header-patterns"
                label="Header patterns (regex)"
                inputAriaLabel="Add header pattern"
                placeholder="Type regex and press Enter"
                values={newNormalizationRules.headerPatterns}
                onChange={(values) =>
                  setNewNormalizationRules((current) => ({
                    ...current,
                    headerPatterns: values,
                  }))
                }
                validator={validateRegexPattern}
              />
            </section>

            <section className="space-y-3 rounded-md border border-border p-3">
              <h3 className="text-sm font-semibold text-foreground">
                Field mappings
              </h3>
              <section className="space-y-2 rounded-md border border-border p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Required mappings
                </h4>
                <p className="text-xs text-muted-foreground">
                  Required: booking date, amount, and one merchant signal field.
                </p>
                <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)]">
                  <span className="text-xs font-medium text-muted-foreground">
                    Destination
                  </span>
                  <span />
                  <span className="text-xs font-medium text-muted-foreground">
                    Source
                  </span>
                  <Input value="bookingDate" disabled className="w-full" />
                  <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
                  <div className="relative">
                    <Input
                      aria-label="Required source field bookingDate"
                      value={getMappingSourceValue(
                        newFieldMappings,
                        "bookingDate",
                      )}
                      onChange={(event) =>
                        updateNewRequiredMapping(
                          "bookingDate",
                          event.target.value,
                        )
                      }
                      placeholder="Source column for booking date"
                      className="w-full pr-8"
                    />
                    {getMappingSourceValue(
                      newFieldMappings,
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
                      aria-label="Required source field amount"
                      value={getMappingSourceValue(newFieldMappings, "amount")}
                      onChange={(event) =>
                        updateNewRequiredMapping("amount", event.target.value)
                      }
                      placeholder="Source column for amount"
                      className="w-full pr-8"
                    />
                    {getMappingSourceValue(
                      newFieldMappings,
                      "amount",
                    ).trim() ? (
                      <Check
                        className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-emerald-600"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <Select
                    value={newMerchantSignalCanonicalField}
                    onValueChange={(value) =>
                      changeNewMerchantSignalCanonicalField(
                        value as MerchantSignalCanonicalField,
                      )
                    }
                  >
                    <SelectTrigger
                      aria-label="Required merchant signal field"
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
                      aria-label="Required source field merchant signal"
                      value={getMappingSourceValue(
                        newFieldMappings,
                        newMerchantSignalCanonicalField,
                      )}
                      onChange={(event) =>
                        updateNewRequiredMapping(
                          newMerchantSignalCanonicalField,
                          event.target.value,
                        )
                      }
                      placeholder="Source column for merchant signal"
                      className="w-full pr-8"
                    />
                    {getMappingSourceValue(
                      newFieldMappings,
                      newMerchantSignalCanonicalField,
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
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Optional mappings
                </h4>
                <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)_auto]">
                  <span className="text-xs font-medium text-muted-foreground">
                    Destination
                  </span>
                  <span />
                  <span className="text-xs font-medium text-muted-foreground">
                    Source
                  </span>
                  <span />
                  {newOptionalFieldMappingRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground md:col-span-4">
                      No optional mappings added.
                    </p>
                  ) : (
                    newOptionalFieldMappingRows.map(
                      ({ fieldMapping, index }) => (
                        <div
                          key={`new-optional-${index + 1}`}
                          className="contents"
                        >
                          <Select
                            value={fieldMapping.canonicalField}
                            onValueChange={(value) =>
                              setNewFieldMappings((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, canonicalField: value }
                                    : item,
                                ),
                              )
                            }
                          >
                            <SelectTrigger
                              aria-label={`Optional canonical field ${index + 1}`}
                              className="w-full"
                            >
                              <SelectValue placeholder="Select canonical field" />
                            </SelectTrigger>
                            <SelectContent>
                              {OPTIONAL_CANONICAL_FIELDS.filter(
                                (option) =>
                                  option !== newMerchantSignalCanonicalField &&
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
                            aria-label={`Optional source column ${index + 1}`}
                            value={fieldMapping.sourceField}
                            onChange={(event) =>
                              setNewFieldMappings((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        sourceField: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Source column"
                            className="w-full"
                          />
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            aria-label={`Remove optional mapping row ${index + 1}`}
                            onClick={() =>
                              setNewFieldMappings((current) =>
                                removeMappingByIndex(current, index),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ),
                    )
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setNewFieldMappings((current) => [
                      ...current,
                      createEmptyFieldMapping(),
                    ])
                  }
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add optional mapping
                </Button>
              </section>
            </section>

            {error && addDialogOpen ? (
              <p
                role="alert"
                className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => void createMapping()}
              disabled={busyKey === "new"}
              className="gap-2"
            >
              {busyKey === "new" ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
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

      <Dialog
        open={editingMappingId !== null}
        onOpenChange={handleEditDialogOpenChange}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit provider mapping</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
            <label
              htmlFor="edit-provider-name"
              className="text-sm font-medium text-foreground"
            >
              Provider name
            </label>
            <Input
              id="edit-provider-name"
              aria-label="Edit provider name"
              value={editProviderName}
              onChange={(event) => setEditProviderName(event.target.value)}
            />
            <label
              htmlFor="edit-mapping-version"
              className="text-sm font-medium text-foreground"
            >
              Mapping version (optional)
            </label>
            <Input
              id="edit-mapping-version"
              aria-label="Edit mapping version"
              inputMode="numeric"
              value={editMappingVersion}
              onChange={(event) => setEditMappingVersion(event.target.value)}
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
              <StringBadgeInput
                key={`edit-required-headers-${editingMappingId}`}
                id={`edit-required-headers-${editingMappingId}`}
                label="Required headers"
                inputAriaLabel="Edit required headers"
                placeholder="Type header and press Enter"
                values={editNormalizationRules.requiredHeaders}
                onChange={(values) =>
                  setEditNormalizationRules((current) => ({
                    ...current,
                    requiredHeaders: values,
                  }))
                }
              />
              <StringBadgeInput
                key={`edit-any-headers-${editingMappingId}`}
                id={`edit-any-headers-${editingMappingId}`}
                label="Optional headers (any)"
                inputAriaLabel="Edit optional headers"
                placeholder="Type header and press Enter"
                values={editNormalizationRules.anyHeaders}
                onChange={(values) =>
                  setEditNormalizationRules((current) => ({
                    ...current,
                    anyHeaders: values,
                  }))
                }
              />
              <StringBadgeInput
                key={`edit-header-patterns-${editingMappingId}`}
                id={`edit-header-patterns-${editingMappingId}`}
                label="Header patterns (regex)"
                inputAriaLabel="Edit header patterns"
                placeholder="Type regex and press Enter"
                values={editNormalizationRules.headerPatterns}
                onChange={(values) =>
                  setEditNormalizationRules((current) => ({
                    ...current,
                    headerPatterns: values,
                  }))
                }
                validator={validateRegexPattern}
              />
            </section>
            <section className="space-y-3 rounded-md border border-border p-3">
              <h4 className="text-sm font-semibold text-foreground">
                Field mappings
              </h4>
              <section className="space-y-2 rounded-md border border-border p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Required mappings
                </h4>
                <p className="text-xs text-muted-foreground">
                  Required: booking date, amount, and one merchant signal field.
                </p>
                <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)]">
                  <span className="text-xs font-medium text-muted-foreground">
                    Destination
                  </span>
                  <span />
                  <span className="text-xs font-medium text-muted-foreground">
                    Source
                  </span>
                  <Input value="bookingDate" disabled className="w-full" />
                  <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
                  <div className="relative">
                    <Input
                      aria-label="Edit required source field bookingDate"
                      value={getMappingSourceValue(
                        editFieldMappings,
                        "bookingDate",
                      )}
                      onChange={(event) =>
                        updateEditRequiredMapping(
                          "bookingDate",
                          event.target.value,
                        )
                      }
                      className="w-full pr-8"
                    />
                    {getMappingSourceValue(
                      editFieldMappings,
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
                      aria-label="Edit required source field amount"
                      value={getMappingSourceValue(editFieldMappings, "amount")}
                      onChange={(event) =>
                        updateEditRequiredMapping("amount", event.target.value)
                      }
                      className="w-full pr-8"
                    />
                    {getMappingSourceValue(
                      editFieldMappings,
                      "amount",
                    ).trim() ? (
                      <Check
                        className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-emerald-600"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <Select
                    value={editMerchantSignalCanonicalField}
                    onValueChange={(value) =>
                      changeEditMerchantSignalCanonicalField(
                        value as MerchantSignalCanonicalField,
                      )
                    }
                  >
                    <SelectTrigger
                      aria-label="Edit required merchant signal field"
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
                      aria-label="Edit required source field merchant signal"
                      value={getMappingSourceValue(
                        editFieldMappings,
                        editMerchantSignalCanonicalField,
                      )}
                      onChange={(event) =>
                        updateEditRequiredMapping(
                          editMerchantSignalCanonicalField,
                          event.target.value,
                        )
                      }
                      className="w-full pr-8"
                    />
                    {getMappingSourceValue(
                      editFieldMappings,
                      editMerchantSignalCanonicalField,
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
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Optional mappings
                </h4>
                <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)_auto]">
                  <span className="text-xs font-medium text-muted-foreground">
                    Destination
                  </span>
                  <span />
                  <span className="text-xs font-medium text-muted-foreground">
                    Source
                  </span>
                  <span />
                  {editOptionalFieldMappingRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground md:col-span-4">
                      No optional mappings added.
                    </p>
                  ) : (
                    editOptionalFieldMappingRows.map(
                      ({ fieldMapping, index }) => (
                        <div
                          key={`edit-optional-${index + 1}`}
                          className="contents"
                        >
                          <Select
                            value={fieldMapping.canonicalField}
                            onValueChange={(value) =>
                              setEditFieldMappings((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        canonicalField: value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            <SelectTrigger
                              aria-label={`Edit optional canonical field ${index + 1}`}
                              className="w-full"
                            >
                              <SelectValue placeholder="Select canonical field" />
                            </SelectTrigger>
                            <SelectContent>
                              {OPTIONAL_CANONICAL_FIELDS.filter(
                                (option) =>
                                  option !== editMerchantSignalCanonicalField &&
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
                            aria-label={`Edit optional source column ${index + 1}`}
                            value={fieldMapping.sourceField}
                            onChange={(event) =>
                              setEditFieldMappings((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        sourceField: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="w-full"
                          />
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            aria-label={`Remove edit optional mapping row ${index + 1}`}
                            onClick={() =>
                              setEditFieldMappings((current) =>
                                removeMappingByIndex(current, index),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ),
                    )
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditFieldMappings((current) => [
                      ...current,
                      createEmptyFieldMapping(),
                    ])
                  }
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add optional mapping
                </Button>
              </section>
            </section>

            {error && editingMappingId !== null ? (
              <p
                role="alert"
                className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingMappingId && void saveEdit(editingMappingId)
              }
              disabled={busyKey === editingMappingId}
              className="gap-2"
            >
              {busyKey === editingMappingId ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Saving...
                </>
              ) : (
                "Save provider mapping"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && !addDialogOpen && editingMappingId === null ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <output className="block rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </output>
      ) : null}

      <Separator className="my-4" />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          Existing mappings
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading mappings...</p>
        ) : mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No provider mappings configured yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Field mappings</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => {
                  const isDeleting = busyKey === `delete-${mapping.id}`;

                  return (
                    <TableRow key={mapping.id}>
                      <TableCell>{mapping.providerName}</TableCell>
                      <TableCell>
                        {mapping.mappingVersion ? (
                          mapping.mappingVersion
                        ) : (
                          <span className="text-muted-foreground">Unset</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {mapping.fieldMappings.length}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={`Actions for ${mapping.providerName}`}
                              disabled={isDeleting}
                            >
                              {isDeleting ? (
                                <Loader2
                                  className="h-4 w-4 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Ellipsis
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onSelect={() => startEdit(mapping)}
                              >
                                <Pencil
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Edit
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => void deleteMapping(mapping.id)}
                              >
                                <Trash2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
