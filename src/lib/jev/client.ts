import {
  APITimeoutError,
  type ChoiceCriteria,
  choice,
  type EntryType,
  type Fetch,
  type RetryPolicy,
  TypeSafeClient,
} from "@typesafe-ai/sdk";

export const DEFAULT_JEV_TIMEOUT_MS = 5_000;

export type JevUnavailableReason =
  | "disabled"
  | "key_missing"
  | "timeout"
  | "provider_error";

export type JevChoiceResult<T extends ChoiceCriteria> =
  | { status: "ok"; choice: keyof T & string; confidence: number }
  | { status: "unavailable"; reason: JevUnavailableReason };

export async function runJevChoice<const T extends ChoiceCriteria>(params: {
  enabled?: boolean;
  apiKey?: string;
  instructions: EntryType;
  alternatives: T;
  state: EntryType;
  timeoutMs?: number;
  retry?: Partial<RetryPolicy>;
  fetchImpl?: Fetch;
}): Promise<JevChoiceResult<T>> {
  if (params.enabled === false) {
    return { status: "unavailable", reason: "disabled" };
  }

  const apiKey = (params.apiKey ?? process.env.TYPESAFE_API_KEY)?.trim();
  if (!apiKey) {
    return { status: "unavailable", reason: "key_missing" };
  }

  const client = new TypeSafeClient({
    apiKey,
    fetch: params.fetchImpl,
    logLevel: "off",
  });

  try {
    const result = await client.systemOne(
      {
        state: params.state,
        questions: {
          pick: choice(params.instructions, params.alternatives),
        },
      },
      {
        timeout: params.timeoutMs ?? DEFAULT_JEV_TIMEOUT_MS,
        retry: params.retry,
      },
    );

    return {
      status: "ok",
      choice: result.answers.pick.choice,
      confidence: result.answers.pick.confidence,
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof APITimeoutError ? "timeout" : "provider_error",
    };
  }
}
