"use client";

import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { REQUIRED_PROVIDER_CANONICAL_FIELDS } from "@/lib/import/provider-mapping-contract";

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

type EditableFieldMapping = {
  sourceField: string;
  canonicalField: string;
};

const DEFAULT_CANONICAL_FIELD = REQUIRED_PROVIDER_CANONICAL_FIELDS[0];

function createEmptyFieldMapping(): EditableFieldMapping {
  return {
    sourceField: "",
    canonicalField: DEFAULT_CANONICAL_FIELD,
  };
}

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
  }

  return "Request failed. Please try again.";
}

function parseJsonInput(value: string): { value: unknown } | { error: string } {
  try {
    return { value: JSON.parse(value) };
  } catch {
    return { error: "Normalization rules must be valid JSON." };
  }
}

function parseMappingVersion(
  value: string,
): { value: number | undefined } | { error: string } {
  const trimmed = value.trim();

  if (!trimmed) {
    return { value: undefined };
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: "Mapping version must be a positive integer." };
  }

  return { value: parsed };
}

function validateFieldMappings(fieldMappings: EditableFieldMapping[]) {
  if (fieldMappings.length === 0) {
    return "Add at least one field mapping.";
  }

  for (const [index, fieldMapping] of fieldMappings.entries()) {
    if (!fieldMapping.sourceField.trim()) {
      return `Source field is required for mapping row ${index + 1}.`;
    }

    if (!fieldMapping.canonicalField.trim()) {
      return `Canonical field is required for mapping row ${index + 1}.`;
    }
  }

  return null;
}

function getCanonicalFieldOptions(fieldMappings: EditableFieldMapping[]) {
  const options = new Set<string>(REQUIRED_PROVIDER_CANONICAL_FIELDS);

  for (const fieldMapping of fieldMappings) {
    const trimmed = fieldMapping.canonicalField.trim();
    if (trimmed) {
      options.add(trimmed);
    }
  }

  return [...options.values()].sort();
}

export function ProviderMappingsManager() {
  const [mappings, setMappings] = useState<ProviderMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [newProviderName, setNewProviderName] = useState("");
  const [newMappingVersion, setNewMappingVersion] = useState("");
  const [newNormalizationRules, setNewNormalizationRules] = useState("{}");
  const [newFieldMappings, setNewFieldMappings] = useState<
    EditableFieldMapping[]
  >([createEmptyFieldMapping()]);

  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [editProviderName, setEditProviderName] = useState("");
  const [editMappingVersion, setEditMappingVersion] = useState("");
  const [editNormalizationRules, setEditNormalizationRules] = useState("{}");
  const [editFieldMappings, setEditFieldMappings] = useState<
    EditableFieldMapping[]
  >([]);

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

  const newCanonicalFieldOptions = useMemo(
    () => getCanonicalFieldOptions(newFieldMappings),
    [newFieldMappings],
  );
  const editCanonicalFieldOptions = useMemo(
    () => getCanonicalFieldOptions(editFieldMappings),
    [editFieldMappings],
  );

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

    const parsedJson = parseJsonInput(newNormalizationRules);
    if ("error" in parsedJson) {
      setError(parsedJson.error);
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
        normalizationRules: parsedJson.value,
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

    setNewProviderName("");
    setNewMappingVersion("");
    setNewNormalizationRules("{}");
    setNewFieldMappings([createEmptyFieldMapping()]);
    setBusyKey(null);
    setNotice("Provider mapping added.");
    await loadMappings();
  }

  function startEdit(mapping: ProviderMapping) {
    setEditingMappingId(mapping.id);
    setEditProviderName(mapping.providerName);
    setEditMappingVersion(
      mapping.mappingVersion ? String(mapping.mappingVersion) : "",
    );
    setEditNormalizationRules(
      JSON.stringify(mapping.normalizationRules ?? {}, null, 2),
    );
    setEditFieldMappings(
      mapping.fieldMappings.map((fieldMapping) => ({
        sourceField: fieldMapping.sourceField,
        canonicalField: fieldMapping.canonicalField,
      })),
    );
    setError(null);
    setNotice(null);
  }

  function cancelEdit() {
    setEditingMappingId(null);
    setEditProviderName("");
    setEditMappingVersion("");
    setEditNormalizationRules("{}");
    setEditFieldMappings([]);
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

    const parsedJson = parseJsonInput(editNormalizationRules);
    if ("error" in parsedJson) {
      setError(parsedJson.error);
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
        normalizationRules: parsedJson.value,
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

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Provider mappings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure source-column to canonical-field assignments and
          normalization rules for CSV providers.
        </p>
      </div>

      <Separator className="my-4" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          Add mapping
        </h2>
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
        <label
          htmlFor="new-normalization-rules"
          className="text-sm font-medium text-foreground"
        >
          Normalization rules (JSON)
        </label>
        <textarea
          id="new-normalization-rules"
          value={newNormalizationRules}
          onChange={(event) => setNewNormalizationRules(event.target.value)}
          rows={5}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
        />

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Field mappings
          </h3>
          <div className="space-y-2">
            {newFieldMappings.map((fieldMapping, index) => (
              <div
                key={`new-${index + 1}`}
                className="grid gap-2 md:grid-cols-3"
              >
                <Input
                  aria-label={`Source column ${index + 1}`}
                  value={fieldMapping.sourceField}
                  onChange={(event) =>
                    setNewFieldMappings((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, sourceField: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="Belop"
                />
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
                  <SelectTrigger aria-label={`Canonical field ${index + 1}`}>
                    <SelectValue placeholder="Select canonical field" />
                  </SelectTrigger>
                  <SelectContent>
                    {newCanonicalFieldOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() =>
                    setNewFieldMappings((current) =>
                      current.length > 1
                        ? current.filter((_, itemIndex) => itemIndex !== index)
                        : current,
                    )
                  }
                  disabled={newFieldMappings.length <= 1}
                >
                  Remove
                </Button>
              </div>
            ))}
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
            Add field mapping
          </Button>
        </div>

        <Button
          onClick={createMapping}
          disabled={busyKey === "new"}
          className="gap-2"
        >
          {busyKey === "new" ? (
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
      </section>

      {error ? (
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => {
                  const isEditing = editingMappingId === mapping.id;
                  const isBusy = busyKey === mapping.id;
                  const isDeleting = busyKey === `delete-${mapping.id}`;

                  return (
                    <TableRow key={mapping.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            aria-label="Edit provider name"
                            value={editProviderName}
                            onChange={(event) =>
                              setEditProviderName(event.target.value)
                            }
                          />
                        ) : (
                          mapping.providerName
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            aria-label="Edit mapping version"
                            inputMode="numeric"
                            value={editMappingVersion}
                            onChange={(event) =>
                              setEditMappingVersion(event.target.value)
                            }
                          />
                        ) : mapping.mappingVersion ? (
                          mapping.mappingVersion
                        ) : (
                          <span className="text-muted-foreground">Unset</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="space-y-2">
                            <label
                              htmlFor={`edit-normalization-rules-${mapping.id}`}
                              className="text-xs font-medium text-foreground"
                            >
                              Normalization rules (JSON)
                            </label>
                            <textarea
                              id={`edit-normalization-rules-${mapping.id}`}
                              aria-label="Edit normalization rules (JSON)"
                              value={editNormalizationRules}
                              onChange={(event) =>
                                setEditNormalizationRules(event.target.value)
                              }
                              rows={4}
                              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
                            />
                            <div className="space-y-2">
                              {editFieldMappings.map((fieldMapping, index) => (
                                <div
                                  key={`edit-${index + 1}`}
                                  className="grid gap-2 md:grid-cols-3"
                                >
                                  <Input
                                    aria-label={`Edit source column ${index + 1}`}
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
                                  />
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
                                      aria-label={`Edit canonical field ${index + 1}`}
                                    >
                                      <SelectValue placeholder="Select canonical field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {editCanonicalFieldOptions.map(
                                        (option) => (
                                          <SelectItem
                                            key={option}
                                            value={option}
                                          >
                                            {option}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      setEditFieldMappings((current) =>
                                        current.length > 1
                                          ? current.filter(
                                              (_, itemIndex) =>
                                                itemIndex !== index,
                                            )
                                          : current,
                                      )
                                    }
                                    disabled={editFieldMappings.length <= 1}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
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
                              Add field mapping
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm">
                            {mapping.fieldMappings.length}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => void saveEdit(mapping.id)}
                              disabled={isBusy}
                              className="gap-2"
                            >
                              {isBusy ? (
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
                            <Button
                              variant="outline"
                              onClick={cancelEdit}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => startEdit(mapping)}
                              className="gap-2"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void deleteMapping(mapping.id)}
                              disabled={isDeleting}
                              className="gap-2"
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                  />
                                  Removing...
                                </>
                              ) : (
                                <>
                                  <Trash2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Delete
                                </>
                              )}
                            </Button>
                          </div>
                        )}
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
