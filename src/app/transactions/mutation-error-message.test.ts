import { describe, expect, it } from "vitest";
import { getMutationErrorMessage } from "./mutation-error-message";

describe("getMutationErrorMessage", () => {
  it("prefers the server-provided message", () => {
    expect(
      getMutationErrorMessage(
        {
          error: "CATEGORY_OR_ACCOUNT_NOT_FOUND",
          message: "Selected account or category was not found.",
        },
        "Could not add transaction.",
      ),
    ).toBe("Selected account or category was not found.");
  });

  it("does not surface a raw error code when message is missing", () => {
    expect(
      getMutationErrorMessage(
        { error: "INVALID_PAYLOAD", details: { merchant: ["Required"] } },
        "Could not add transaction.",
      ),
    ).toBe("Could not add transaction.");
  });

  it("falls back when the body is not an object", () => {
    expect(getMutationErrorMessage(null, "Could not delete transaction.")).toBe(
      "Could not delete transaction.",
    );
  });

  it("falls back when message is empty", () => {
    expect(
      getMutationErrorMessage(
        { error: "INVALID_PAYLOAD", message: "" },
        "Could not add transaction.",
      ),
    ).toBe("Could not add transaction.");
  });
});
