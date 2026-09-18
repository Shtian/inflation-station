import { describe, expect, it } from "vitest";
import { deriveCleanupStreamStatus } from "./cleanup-stream-status";
import { resolveRowMessage } from "./resolve-row-message";

describe("deriveCleanupStreamStatus", () => {
  it("returns all zeros for an empty map", () => {
    expect(deriveCleanupStreamStatus({})).toEqual({
      total: 0,
      cleaned: 0,
      pending: 0,
      failed: 0,
    });
  });

  it("counts pending, cleaned, none, and unavailable rows", () => {
    const resolvedMessages = {
      "row-pending": resolveRowMessage({
        originalMessage: "JOKER TRONDHEIM",
        suggestion: { status: "pending" },
      }),
      "row-cleaned": resolveRowMessage({
        originalMessage: "RUTER BILLETT",
        suggestion: { status: "cleaned", text: "Ruter Billett" },
      }),
      "row-none": resolveRowMessage({
        originalMessage: "REMA 1000",
        suggestion: { status: "none" },
      }),
      "row-unavailable": resolveRowMessage({
        originalMessage: "KIWI OSLO",
        suggestion: { status: "unavailable", reason: "provider_error" },
      }),
    };

    expect(deriveCleanupStreamStatus(resolvedMessages)).toEqual({
      total: 4,
      cleaned: 1,
      pending: 1,
      failed: 1,
    });
  });
});
