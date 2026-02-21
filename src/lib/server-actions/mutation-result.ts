import type { ZodError } from "zod";

export type MutationActionError<TCode extends string = string> = {
  code: TCode;
  message: string;
  details?: unknown;
};

export type MutationActionResult<TData, TCode extends string = string> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: MutationActionError<TCode>;
    };

type ExecuteServerMutationOptions<TData, TCode extends string> = {
  execute: () => Promise<TData>;
  mapError?: (error: unknown) => MutationActionError<TCode> | null;
  fallbackError: MutationActionError<TCode>;
};

export function mutationOk<TData>(
  data: TData,
): MutationActionResult<TData, never> {
  return { ok: true, data };
}

export function mutationError<TCode extends string>(
  code: TCode,
  message: string,
  details?: unknown,
): MutationActionResult<never, TCode> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}

export function mutationValidationError<TCode extends string>(
  code: TCode,
  message: string,
  error: ZodError,
): MutationActionResult<never, TCode> {
  const flattened = error.flatten();

  return mutationError(code, message, {
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  });
}

export async function executeServerMutation<TData, TCode extends string>(
  options: ExecuteServerMutationOptions<TData, TCode>,
): Promise<MutationActionResult<TData, TCode>> {
  try {
    const data = await options.execute();
    return {
      ok: true,
      data,
    };
  } catch (error) {
    const mappedError = options.mapError?.(error) ?? null;

    if (mappedError) {
      return {
        ok: false,
        error: mappedError,
      };
    }

    return {
      ok: false,
      error: options.fallbackError,
    };
  }
}
