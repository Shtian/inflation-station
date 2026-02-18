import type { Prisma } from "@prisma/client";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isInputJsonValue(
  value: unknown,
): value is Prisma.InputJsonValue {
  if (value === null) {
    return false;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isInputJsonValue(item));
  }

  if (isPlainObject(value)) {
    return Object.values(value).every((item) => isInputJsonValue(item));
  }

  return false;
}
