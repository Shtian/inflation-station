import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type NormalizationFormState,
  SUPPORTED_CSV_DELIMITERS,
  SUPPORTED_DATE_FORMATS,
  SUPPORTED_DECIMAL_SEPARATORS,
  validateRegexPattern,
} from "../provider-mappings-manager.utils";
import { ProviderMappingStringBadgeInput } from "./provider-mapping-string-badge-input";

const UNSET = "__unset__";

/**
 * Shared "provider detection rules" editor rendered by both the add and
 * edit dialogs. Only exposes the closed rule vocabulary the runtime adapter
 * compiler supports, so the form always represents what will actually run.
 */
export function ProviderMappingNormalizationRulesSection(props: {
  idPrefix: string;
  normalizationRules: NormalizationFormState;
  onChange(value: NormalizationFormState): void;
}) {
  const { normalizationRules, onChange } = props;

  return (
    <section className="space-y-3 rounded-md border border-border p-3">
      <div className="space-y-1">
        <h4 className="font-semibold text-foreground text-sm">
          Provider detection and parsing rules
        </h4>
        <p className="text-muted-foreground text-xs">
          Used to match the uploaded CSV to this provider mapping and to
          interpret its cells during import parsing.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <span className="font-medium text-muted-foreground text-xs">
            Delimiter
          </span>
          <Select
            value={normalizationRules.delimiter ?? UNSET}
            onValueChange={(value) =>
              onChange({
                ...normalizationRules,
                delimiter: value === UNSET ? undefined : (value as ";" | ","),
              })
            }
          >
            <SelectTrigger
              aria-label={`${props.idPrefix} delimiter`}
              className="w-full"
            >
              <SelectValue placeholder="Auto-detect" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>Auto-detect</SelectItem>
              {SUPPORTED_CSV_DELIMITERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === ";" ? "Semicolon ( ; )" : "Comma ( , )"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="font-medium text-muted-foreground text-xs">
            Decimal separator
          </span>
          <Select
            value={normalizationRules.decimalSeparator ?? UNSET}
            onValueChange={(value) =>
              onChange({
                ...normalizationRules,
                decimalSeparator:
                  value === UNSET ? undefined : (value as "," | "."),
              })
            }
          >
            <SelectTrigger
              aria-label={`${props.idPrefix} decimal separator`}
              className="w-full"
            >
              <SelectValue placeholder="Comma (default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>Comma (default)</SelectItem>
              {SUPPORTED_DECIMAL_SEPARATORS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "," ? "Comma ( , )" : "Period ( . )"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="font-medium text-muted-foreground text-xs">
            Date format
          </span>
          <Select
            value={normalizationRules.dateFormat ?? UNSET}
            onValueChange={(value) =>
              onChange({
                ...normalizationRules,
                dateFormat:
                  value === UNSET
                    ? undefined
                    : (value as "DD.MM.YYYY" | "YYYY-MM-DD"),
              })
            }
          >
            <SelectTrigger
              aria-label={`${props.idPrefix} date format`}
              className="w-full"
            >
              <SelectValue placeholder="Auto-detect" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>Auto-detect</SelectItem>
              {SUPPORTED_DATE_FORMATS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ProviderMappingStringBadgeInput
        id={`${props.idPrefix}-required-headers`}
        label="Required headers"
        inputAriaLabel="Add required header"
        placeholder="Type header and press Enter"
        values={normalizationRules.requiredHeaders}
        onChange={(values) =>
          onChange({ ...normalizationRules, requiredHeaders: values })
        }
      />
      <ProviderMappingStringBadgeInput
        id={`${props.idPrefix}-any-headers`}
        label="Optional headers (any)"
        inputAriaLabel="Add optional header"
        placeholder="Type header and press Enter"
        values={normalizationRules.anyHeaders}
        onChange={(values) =>
          onChange({ ...normalizationRules, anyHeaders: values })
        }
      />
      <ProviderMappingStringBadgeInput
        id={`${props.idPrefix}-header-patterns`}
        label="Header patterns (regex)"
        inputAriaLabel="Add header pattern"
        placeholder="Type regex and press Enter"
        values={normalizationRules.headerPatterns}
        onChange={(values) =>
          onChange({ ...normalizationRules, headerPatterns: values })
        }
        validator={validateRegexPattern}
      />
    </section>
  );
}
