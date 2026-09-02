import { z } from "zod";

/**
 * Closed, tagged transform vocabulary. Field transforms use this rather than
 * arbitrary JSON execution. Transforms run after cell extraction and before
 * canonical field validation, in the order they are stored for a field.
 */
export const transformRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("trim") }),
  z.object({ type: z.literal("uppercase") }),
  z.object({ type: z.literal("lowercase") }),
  z.object({
    type: z.literal("valueMap"),
    values: z.record(z.string(), z.string()),
    fallback: z.string().optional(),
  }),
  z.object({
    type: z.literal("sign"),
    value: z.enum(["positive", "negative"]),
  }),
]);

export type TransformRule = z.infer<typeof transformRuleSchema>;

export const transformRulesSchema = z.array(transformRuleSchema);

function applySign(value: string, sign: "positive" | "negative"): string {
  const trimmed = value.trim();
  const bare = trimmed.startsWith("-")
    ? trimmed.slice(1)
    : trimmed.startsWith("+")
      ? trimmed.slice(1)
      : trimmed;

  return sign === "negative" ? `-${bare}` : bare;
}

/**
 * Applies a field's transform rules, in order, to one extracted cell value.
 */
export function applyTransforms(
  value: string,
  rules: ReadonlyArray<TransformRule>,
): string {
  let result = value;

  for (const rule of rules) {
    switch (rule.type) {
      case "trim":
        result = result.trim();
        break;
      case "uppercase":
        result = result.toUpperCase();
        break;
      case "lowercase":
        result = result.toLowerCase();
        break;
      case "valueMap": {
        const key = result.trim();
        if (Object.hasOwn(rule.values, key)) {
          result = rule.values[key];
        } else if (rule.fallback !== undefined) {
          result = rule.fallback;
        }
        break;
      }
      case "sign":
        result = applySign(result, rule.value);
        break;
      default:
        break;
    }
  }

  return result;
}
