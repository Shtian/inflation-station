import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ProviderFieldTransform,
  ProviderFieldTransformType,
} from "../../../lib/import/provider-adapter/mapping-definition";
import { PROVIDER_FIELD_TRANSFORM_TYPES } from "../../../lib/import/provider-adapter/mapping-definition";
import {
  describeFieldTransform,
  parseMapValuesLines,
} from "../provider-mappings-manager.utils";

const TRANSFORM_TYPE_LABELS: Record<ProviderFieldTransformType, string> = {
  trim: "Trim",
  uppercase: "Uppercase",
  lowercase: "Lowercase",
  mapValues: "Map values",
  applySign: "Apply sign",
};

const DEFAULT_DRAFT_TYPE: ProviderFieldTransformType = "trim";
const DEFAULT_DRAFT_SIGN: "negative" | "positive" = "negative";

/**
 * Small, honest editor for the closed v1 transform vocabulary. Transforms are
 * add/remove only (no in-place edit) so state stays simple: build a valid
 * transform in the draft row, add it to the ordered list, or remove an entry.
 * This never represents an unsupported transform shape, so nothing round-trips
 * data the runtime cannot execute.
 */
export function ProviderMappingFieldTransformsEditor(props: {
  idPrefix: string;
  fieldLabel: string;
  transforms: ProviderFieldTransform[];
  onChange(transforms: ProviderFieldTransform[]): void;
}) {
  const [draftType, setDraftType] =
    useState<ProviderFieldTransformType>(DEFAULT_DRAFT_TYPE);
  const [draftSign, setDraftSign] = useState<"negative" | "positive">(
    DEFAULT_DRAFT_SIGN,
  );
  const [draftMapValuesText, setDraftMapValuesText] = useState("");
  const [draftFallback, setDraftFallback] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  function resetDraft() {
    setDraftType(DEFAULT_DRAFT_TYPE);
    setDraftSign(DEFAULT_DRAFT_SIGN);
    setDraftMapValuesText("");
    setDraftFallback("");
    setDraftError(null);
  }

  function addDraftTransform() {
    if (
      draftType === "trim" ||
      draftType === "uppercase" ||
      draftType === "lowercase"
    ) {
      props.onChange([...props.transforms, { type: draftType }]);
      resetDraft();
      return;
    }

    if (draftType === "applySign") {
      props.onChange([
        ...props.transforms,
        { type: "applySign", sign: draftSign },
      ]);
      resetDraft();
      return;
    }

    const parsed = parseMapValuesLines(draftMapValuesText);
    if ("error" in parsed) {
      setDraftError(parsed.error);
      return;
    }

    const fallback = draftFallback.trim();
    props.onChange([
      ...props.transforms,
      {
        type: "mapValues",
        values: parsed.values,
        ...(fallback ? { fallback } : {}),
      },
    ]);
    resetDraft();
  }

  function removeTransform(index: number) {
    props.onChange(props.transforms.filter((_, i) => i !== index));
  }

  const typeSelectId = `${props.idPrefix}-transform-type`;

  return (
    <div className="space-y-2 md:col-span-full">
      <p className="font-medium text-muted-foreground text-xs">
        Transforms for {props.fieldLabel}
      </p>
      {props.transforms.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {props.transforms.map((transform, index) => (
            <Badge
              key={`${transform.type}-${index}`}
              variant="secondary"
              className="gap-1"
            >
              <span>{describeFieldTransform(transform)}</span>
              <button
                type="button"
                aria-label={`Remove transform "${describeFieldTransform(transform)}" for ${props.fieldLabel}`}
                className="rounded-full p-0.5 hover:bg-black/10"
                onClick={() => removeTransform(index)}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No transforms added.</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Field className="w-auto">
          <FieldLabel htmlFor={typeSelectId} className="text-xs">
            Add transform
          </FieldLabel>
          <FieldContent>
            <Select
              value={draftType}
              onValueChange={(value) => {
                setDraftType(value as ProviderFieldTransformType);
                setDraftError(null);
              }}
            >
              <SelectTrigger
                id={typeSelectId}
                aria-label={`Add transform type for ${props.fieldLabel}`}
                className="w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_FIELD_TRANSFORM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TRANSFORM_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>

        {draftType === "applySign" ? (
          <Field className="w-auto">
            <FieldLabel
              htmlFor={`${props.idPrefix}-transform-sign`}
              className="text-xs"
            >
              Sign
            </FieldLabel>
            <FieldContent>
              <Select
                value={draftSign}
                onValueChange={(value) =>
                  setDraftSign(value as "negative" | "positive")
                }
              >
                <SelectTrigger
                  id={`${props.idPrefix}-transform-sign`}
                  aria-label={`Sign for ${props.fieldLabel} transform`}
                  className="w-32"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Add transform for ${props.fieldLabel}`}
          onClick={addDraftTransform}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>

      {draftType === "mapValues" ? (
        <div className="grid gap-2 md:grid-cols-2">
          <Field>
            <FieldLabel
              htmlFor={`${props.idPrefix}-transform-map-values`}
              className="text-xs"
            >
              Value mappings (one "from=to" per line)
            </FieldLabel>
            <FieldContent>
              <Textarea
                id={`${props.idPrefix}-transform-map-values`}
                aria-label={`Map values for ${props.fieldLabel}`}
                value={draftMapValuesText}
                onChange={(event) => {
                  setDraftMapValuesText(event.target.value);
                  if (draftError) {
                    setDraftError(null);
                  }
                }}
                placeholder={"KORT=card\nOVERFORING=transfer"}
                rows={3}
                aria-invalid={draftError ? true : undefined}
              />
              <FieldError>{draftError}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel
              htmlFor={`${props.idPrefix}-transform-fallback`}
              className="text-xs"
            >
              Fallback (optional)
            </FieldLabel>
            <FieldContent>
              <Input
                id={`${props.idPrefix}-transform-fallback`}
                aria-label={`Fallback value for ${props.fieldLabel}`}
                value={draftFallback}
                onChange={(event) => setDraftFallback(event.target.value)}
                placeholder="other"
              />
            </FieldContent>
          </Field>
        </div>
      ) : null}
    </div>
  );
}
