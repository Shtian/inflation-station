import { X } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  mergeStringList,
  removeStringListValue,
} from "../provider-mappings-manager.utils";

export function ProviderMappingStringBadgeInput(props: {
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
      <Label htmlFor={props.id} className="font-medium text-foreground text-sm">
        {props.label}
      </Label>
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
        <p className="text-red-700 text-xs" role="alert">
          {inputError}
        </p>
      ) : null}
      {props.values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {props.values.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="fade-in-0 slide-in-from-top-1 animate-in gap-1 duration-200"
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
        <p className="text-muted-foreground text-xs">No values added yet.</p>
      )}
    </div>
  );
}
