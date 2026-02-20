function readErrorProperty(error: unknown, key: string): unknown {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if (!(key in error)) {
    return undefined;
  }

  return (error as Record<string, unknown>)[key];
}

function asDetailFragment(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

export function buildProviderErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    const direct = [error.name, error.message]
      .filter(Boolean)
      .join(": ")
      .trim();
    const code = asDetailFragment(readErrorProperty(error, "code"));
    const statusCode = asDetailFragment(readErrorProperty(error, "statusCode"));
    const statusText = asDetailFragment(readErrorProperty(error, "statusText"));
    const responseBody = asDetailFragment(
      readErrorProperty(error, "responseBody"),
    );

    const fragments = [
      direct || "Unknown error",
      code ? `code=${code}` : null,
      statusCode ? `statusCode=${statusCode}` : null,
      statusText ? `statusText=${statusText}` : null,
      responseBody ? `responseBody=${responseBody.slice(0, 300)}` : null,
    ].filter((fragment): fragment is string => Boolean(fragment));

    return fragments.join(" | ");
  }

  if (typeof error === "string") {
    return error.trim() || "Unknown provider error";
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown provider error";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}
