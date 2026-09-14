import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  executeServerMutation,
  mutationError,
  mutationOk,
  mutationValidationError,
} from "./mutation-result";

describe("mutation-result", () => {
  it("returns success payload from mutationOk", () => {
    expect(mutationOk({ updated: true })).toEqual({
      ok: true,
      data: {
        updated: true,
      },
    });
  });

  it("returns typed error payload from mutationError", () => {
    expect(
      mutationError("INVALID_INPUT", "Invalid payload", {
        fieldErrors: {
          promptText: ["Required"],
        },
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid payload",
        details: {
          fieldErrors: {
            promptText: ["Required"],
          },
        },
      },
    });
  });

  it("builds flattened zod details from mutationValidationError", () => {
    const schema = z.object({
      promptText: z.string().min(1),
    });
    const parsed = schema.safeParse({ promptText: "" });

    if (parsed.success) {
      throw new Error("Expected parse failure");
    }

    const result = mutationValidationError(
      "INVALID_PAYLOAD",
      "Invalid payload",
      parsed.error,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected error result");
    }

    expect(result.error.code).toBe("INVALID_PAYLOAD");
    expect(result.error.details).toEqual({
      fieldErrors: {
        promptText: ["Too small: expected string to have >=1 characters"],
      },
      formErrors: [],
    });
  });

  it("maps known errors in executeServerMutation without logging them", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const result = await executeServerMutation({
        execute: async () => {
          throw new Error("boom");
        },
        mapError: (error) =>
          error instanceof Error && error.message === "boom"
            ? { code: "KNOWN_ERROR", message: "Known failure" }
            : null,
        fallbackError: {
          code: "UNKNOWN_ERROR",
          message: "Unknown failure",
        },
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "KNOWN_ERROR",
          message: "Known failure",
        },
      });
      expect(errorSpy.mock.calls).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("logs unmapped errors with the fallback code in executeServerMutation", async () => {
    const thrown = new Error("database disk image is malformed");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const result = await executeServerMutation({
        execute: async () => {
          throw thrown;
        },
        mapError: () => null,
        fallbackError: {
          code: "PROVIDER_MAPPING_CREATE_FAILED",
          message: "Could not create provider mapping.",
        },
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "PROVIDER_MAPPING_CREATE_FAILED",
          message: "Could not create provider mapping.",
        },
      });
      expect(errorSpy.mock.calls).toHaveLength(1);
      expect(errorSpy.mock.calls[0][0]).toBe("Server action mutation failed");
      expect(errorSpy.mock.calls[0][1]).toEqual({
        code: "PROVIDER_MAPPING_CREATE_FAILED",
        error: thrown,
      });
      expect(errorSpy.mock.calls[0][1].error).toBe(thrown);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
