import { describe, expect, it } from "vitest";
import { getMutationErrorMessage } from "./mutation-error-message";

describe("getMutationErrorMessage", () => {
  it("prefers the server-provided message", () => {
    expect(
      getMutationErrorMessage(
        {
          error: "CATEGORY_OR_ACCOUNT_NOT_FOUND",
          message: "Fant ikke den valgte kontoen eller kategorien.",
        },
        "Kunne ikke legge til transaksjonen.",
      ),
    ).toBe("Fant ikke den valgte kontoen eller kategorien.");
  });

  it("does not surface a raw error code when message is missing", () => {
    expect(
      getMutationErrorMessage(
        { error: "INVALID_PAYLOAD", details: { merchant: ["Required"] } },
        "Kunne ikke legge til transaksjonen.",
      ),
    ).toBe("Kunne ikke legge til transaksjonen.");
  });

  it("falls back when the body is not an object", () => {
    expect(
      getMutationErrorMessage(null, "Kunne ikke slette transaksjonen."),
    ).toBe("Kunne ikke slette transaksjonen.");
  });

  it("falls back when message is empty", () => {
    expect(
      getMutationErrorMessage(
        { error: "INVALID_PAYLOAD", message: "" },
        "Kunne ikke legge til transaksjonen.",
      ),
    ).toBe("Kunne ikke legge til transaksjonen.");
  });
});
